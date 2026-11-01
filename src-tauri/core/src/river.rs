//! The River: today as one lane per workstream. Each lane carries its
//! sessions' timeline spans since `since` (agent working, or waiting on you),
//! its progress, how many helper agents are on it, and the next step only a
//! person can do. Sessions in no workstream share one "Quick fixes" lane.
//! Which sessions are waiting right now comes from the live view, joined in
//! the page by `session_ids`.

use std::collections::{HashMap, HashSet};

use anyhow::Result;
use rusqlite::Connection;
use serde::Serialize;

use crate::tasks::TaskStatus;
use crate::workstreams::{self, TaskKind};

/// [start, end, kind] spans of one session, and when it ended.
type Day = (Vec<(i64, i64, u8)>, i64);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RiverLane {
    /// The workstream's key; none for the Quick fixes lane.
    pub key: Option<String>,
    pub title: String,
    pub repo: Option<String>,
    pub starred: bool,
    pub done: usize,
    pub total: usize,
    /// Sub-agents that worked on it today.
    pub helpers: usize,
    /// The first unfinished task only a person can do.
    pub human_next: Option<String>,
    pub session_ids: Vec<String>,
    /// [start, end, kind] since `since`: 0 waiting on you, else agent work.
    pub spans: Vec<(i64, i64, u8)>,
    pub last_activity: i64,
}

/// Lanes with activity since `since`, busiest-recent first; Quick fixes last.
pub fn river(conn: &Connection, since: i64) -> Result<Vec<RiverLane>> {
    let mut timelines: HashMap<String, Day> = HashMap::new();
    let mut st = conn.prepare(
        "SELECT id, timeline, ended_at FROM sessions WHERE ended_at >= ?1 AND timeline != '[]'",
    )?;
    for row in st.query_map([since], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
        ))
    })? {
        let (id, tl, ended) = row?;
        let spans: Vec<(i64, i64, u8)> = serde_json::from_str::<Vec<(i64, i64, u8)>>(&tl)
            .unwrap_or_default()
            .into_iter()
            .filter(|(_, end, _)| *end >= since)
            .map(|(a, b, k)| (a.max(since), b, k))
            .collect();
        if !spans.is_empty() {
            timelines.insert(id, (spans, ended));
        }
    }

    let mut claimed: HashSet<String> = HashSet::new();
    let mut lanes = vec![];
    for w in workstreams::workstreams(conn, 1)? {
        if w.archived {
            continue;
        }
        let ids: Vec<String> = w
            .sessions
            .iter()
            .map(|s| s.id.clone())
            .filter(|id| timelines.contains_key(id))
            .collect();
        if ids.is_empty() {
            continue;
        }
        let mut spans = vec![];
        let mut last = 0;
        for id in &ids {
            let (s, ended) = &timelines[id];
            spans.extend_from_slice(s);
            last = last.max(*ended);
            claimed.insert(id.clone());
        }
        spans.sort_unstable();
        let today: HashSet<&String> = ids.iter().collect();
        lanes.push(RiverLane {
            key: Some(w.key),
            title: w.title,
            repo: w.repo,
            starred: w.starred,
            done: w.counts.done,
            total: w.counts.done + w.counts.in_progress + w.counts.pending,
            helpers: w
                .agents
                .iter()
                .filter(|a| a.role != "lead" && today.contains(&a.session_id))
                .count(),
            human_next: w
                .tasks
                .iter()
                .find(|t| {
                    t.kind == TaskKind::Human
                        && !matches!(t.status, TaskStatus::Done | TaskStatus::Cancelled)
                })
                .map(|t| t.title.clone()),
            session_ids: ids,
            spans,
            last_activity: last,
        });
    }
    lanes.sort_by_key(|l| (!l.starred, std::cmp::Reverse(l.last_activity)));

    let mut rest: Vec<(&String, &Day)> = timelines
        .iter()
        .filter(|(id, _)| !claimed.contains(*id))
        .collect();
    if !rest.is_empty() {
        rest.sort_by_key(|(_, (_, ended))| std::cmp::Reverse(*ended));
        let mut spans: Vec<(i64, i64, u8)> =
            rest.iter().flat_map(|(_, (s, _))| s.clone()).collect();
        spans.sort_unstable();
        lanes.push(RiverLane {
            key: None,
            title: "Quick fixes".into(),
            repo: None,
            starred: false,
            done: 0,
            total: 0,
            helpers: 0,
            human_next: None,
            last_activity: rest[0].1.1,
            session_ids: rest.into_iter().map(|(id, _)| id.clone()).collect(),
            spans,
        });
    }
    Ok(lanes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_todays_sessions_into_lanes() {
        let conn = crate::db::open_in_memory().unwrap();
        let now = crate::util::now_ms();
        let t0 = now - 3_600_000;
        let tl = serde_json::to_string(&[(t0, t0 + 600_000, 1u8), (t0 + 600_000, t0 + 660_000, 0)])
            .unwrap();
        for (id, branch) in [("a", "feature/pay"), ("b", "feature/pay"), ("c", "main")] {
            conn.execute(
                "INSERT INTO sessions (id, source, external_id, file_path, repo_root, git_branch, started_at,
                   ended_at, active_ms, user_turns, timeline, ingested_at)
                 VALUES (?1, 'claude_code', ?1, '/f', '/code/pay', ?2, ?3, ?4, 0, 2, ?5, ?4)",
                rusqlite::params![id, branch, t0, now, tl],
            )
            .unwrap();
        }
        let lanes = river(&conn, now - 6 * 3_600_000).unwrap();
        let last = lanes.last().unwrap();
        assert_eq!(
            (last.key.as_deref(), last.title.as_str()),
            (None, "Quick fixes")
        );
        assert_eq!(last.session_ids, vec!["c".to_string()]);
        let pay = lanes.iter().find(|l| l.key.is_some()).unwrap();
        let mut ids = pay.session_ids.clone();
        ids.sort();
        assert_eq!(ids, vec!["a", "b"]);
        assert_eq!(pay.spans.len(), 4);
        // Spans before `since` are left out.
        assert!(river(&conn, now + 1).unwrap().is_empty());
    }
}
