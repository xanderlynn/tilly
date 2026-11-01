//! A workstream's pulse, for the list of all workstreams: how much of its
//! done work is proven (a merged PR, or a tracker item a person closed),
//! how much rests on commits or the agent's word, what's stuck, how long its
//! agents waited on you this week against last, what it cost this week, and
//! what needs you, with how much work each thing frees.

use std::collections::{HashMap, HashSet};

use anyhow::Result;
use rusqlite::Connection;
use serde::Serialize;

use crate::live::{self, Group};
use crate::stats::DAY_MS;
use crate::tasks::TaskStatus;
use crate::workstreams::{TaskKind, Workstream};

#[derive(Debug, Default, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Pulse {
    /// Tasks counted, as in the workstream's progress counts.
    pub total: usize,
    /// Done and proven: a merged pull request, or a tracker item closed by a person.
    pub proven: usize,
    /// Done with commits but no merged pull request.
    pub committed: usize,
    /// Done on the agent's word only.
    pub word: usize,
    pub stuck: usize,
    pub in_progress: usize,
    pub not_started: usize,
    /// Hours its sessions waited on you in the last 7 days, and the 7 before.
    pub wait_hours: f64,
    pub wait_hours_prev: f64,
    pub cost_week: f64,
    /// Yours to follow: plain sessions of yours, or an import with an item assigned to you.
    pub mine: bool,
    /// What needs you, most work freed first.
    pub needs: Vec<Need>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Need {
    pub title: String,
    /// The session to open, for an agent waiting on you; none for a task of yours.
    pub session_id: Option<String>,
    /// Since when it has waited.
    pub since: i64,
    /// Tasks it frees: itself plus those that wait for it.
    pub frees: usize,
}

/// A session's waiting spans, cost and end, for the last two weeks.
type Recent = (Vec<(i64, i64, u8)>, Option<f64>, i64);

/// What pulses need beyond the workstreams: session timelines and costs
/// for the last two weeks, and which pull requests merged.
pub struct Context {
    sessions: HashMap<String, Recent>,
    merged: HashSet<String>,
    now: i64,
}

pub fn context(conn: &Connection) -> Result<Context> {
    let now = crate::util::now_ms();
    let mut sessions = HashMap::new();
    let mut st =
        conn.prepare("SELECT id, timeline, cost_usd, ended_at FROM sessions WHERE ended_at >= ?1")?;
    for row in st.query_map([now - 14 * DAY_MS], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<f64>>(2)?,
            r.get::<_, i64>(3)?,
        ))
    })? {
        let (id, tl, cost, ended) = row?;
        let spans = serde_json::from_str(&tl).unwrap_or_default();
        sessions.insert(id, (spans, cost, ended));
    }
    let merged = conn
        .prepare("SELECT url FROM pr_states WHERE state = 'MERGED'")?
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<HashSet<_>>>()?;
    Ok(Context {
        sessions,
        merged,
        now,
    })
}

pub fn pulse(w: &Workstream, cx: &Context) -> Pulse {
    let now = cx.now;
    let week = now - 7 * DAY_MS;
    let fortnight = now - 14 * DAY_MS;
    let has_items = w.tasks.iter().any(|t| t.session_id.is_empty());
    let parents: HashSet<&str> = w.tasks.iter().filter_map(|t| t.parent.as_deref()).collect();
    let counted: Vec<_> = w
        .tasks
        .iter()
        .filter(|t| (!has_items || t.session_id.is_empty()) && !parents.contains(t.key.as_str()))
        .collect();
    let by_id: HashMap<&str, _> = w.sessions.iter().map(|s| (s.id.as_str(), s)).collect();
    let evidence = |ids: &mut dyn Iterator<Item = &String>| {
        let (mut merged, mut commits) = (false, false);
        for id in ids {
            if let Some(s) = by_id.get(id.as_str()) {
                merged |= s.prs.iter().any(|p| cx.merged.contains(p));
                commits |= s.commits > 0;
            }
        }
        (merged, commits)
    };
    let done = |s: TaskStatus| matches!(s, TaskStatus::Done | TaskStatus::Cancelled);
    let mut p = Pulse {
        total: counted.len(),
        ..Default::default()
    };
    for t in &counted {
        match t.status {
            TaskStatus::Done => {
                let item = t.session_id.is_empty();
                let (merged, commits) = if item {
                    evidence(&mut t.sessions.iter())
                } else {
                    evidence(&mut std::iter::once(&t.session_id))
                };
                if merged || item {
                    // A tracker item is closed in the tracker: a person signed it off.
                    p.proven += 1;
                } else if commits {
                    p.committed += 1;
                } else {
                    p.word += 1;
                }
            }
            TaskStatus::Cancelled => p.proven += 1,
            TaskStatus::Blocked => p.stuck += 1,
            _ if t
                .blocked_by
                .iter()
                .any(|k| w.tasks.iter().any(|o| &o.key == k && !done(o.status))) =>
            {
                p.stuck += 1
            }
            TaskStatus::InProgress => p.in_progress += 1,
            _ => p.not_started += 1,
        }
    }
    for s in &w.sessions {
        if let Some((spans, cost, ended)) = cx.sessions.get(&s.id) {
            for &(a, b, k) in spans {
                if k != 0 || b <= fortnight {
                    continue;
                }
                let h = |from: i64, to: i64| (b.min(to) - a.max(from)).max(0) as f64 / 3_600_000.0;
                p.wait_hours += h(week, now);
                p.wait_hours_prev += h(fortnight, week);
            }
            if *ended >= week {
                p.cost_week += cost.unwrap_or(0.0);
            }
        }
    }
    p.mine = w.source_url.is_none() || w.tasks.iter().any(|t| t.mine);

    let frees = |key: &str| {
        1 + w
            .tasks
            .iter()
            .filter(|t| !done(t.status) && t.blocked_by.iter().any(|k| k == key))
            .count()
    };
    let mut needs: Vec<Need> = counted
        .iter()
        .filter(|t| {
            t.kind == TaskKind::Human
                && !done(t.status)
                && (!t.session_id.is_empty() || t.mine || t.agent.is_none())
        })
        .map(|t| Need {
            title: t.title.clone(),
            session_id: None,
            since: t.updated_at.unwrap_or(w.last_activity),
            frees: frees(&t.key),
        })
        .collect();
    needs.extend(
        w.sessions
            .iter()
            .filter(|s| {
                s.status.group() == Group::Awaiting && now - s.ended_at < live::LIVE_WINDOW_MS
            })
            .map(|s| Need {
                title: s.title.clone().unwrap_or_else(|| "A session".into()),
                session_id: Some(s.id.clone()),
                since: s.ended_at,
                frees: w
                    .tasks
                    .iter()
                    .filter(|t| t.session_id == s.id && !done(t.status))
                    .count()
                    .max(1),
            }),
    );
    needs.sort_by(|a, b| score(b, now).total_cmp(&score(a, now)));
    p.needs = needs;
    p
}

/// Work freed × (1 + days waited): how Act now ranks.
pub fn score(n: &Need, now: i64) -> f64 {
    n.frees as f64 * (1.0 + (now - n.since).max(0) as f64 / DAY_MS as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranks_by_work_freed_and_wait() {
        let now = 10 * DAY_MS;
        let need = |frees, days: i64| Need {
            title: String::new(),
            session_id: None,
            since: now - days * DAY_MS,
            frees,
        };
        // Freeing 4 after 2 days beats freeing 6 just now, and freeing 2 after 4 days.
        assert!(score(&need(4, 2), now) > score(&need(6, 0), now));
        assert!(score(&need(4, 2), now) > score(&need(2, 4), now));
    }

    #[test]
    fn splits_proof_and_counts_waits() {
        let conn = crate::db::open_in_memory().unwrap();
        let now = crate::util::now_ms();
        let t0 = now - 2 * 3_600_000;
        // a: commits and a merged PR; b: commits only; c: neither.
        let tl = serde_json::to_string(&[
            (t0, t0 + 1_800_000, 1u8),
            (t0 + 1_800_000, t0 + 3_600_000, 0),
        ])
        .unwrap();
        for (id, prs, todos) in [
            (
                "a",
                r#"["https://github.com/o/r/pull/1"]"#,
                r#"{"tasks":[{"id":"1","title":"Build it","status":"done"}]}"#,
            ),
            (
                "b",
                "[]",
                r#"{"tasks":[{"id":"1","title":"Test it","status":"done"}]}"#,
            ),
            (
                "c",
                "[]",
                r#"{"tasks":[{"id":"1","title":"Document it","status":"done"},{"id":"2","title":"Approve the release","status":"pending"}]}"#,
            ),
        ] {
            conn.execute(
                "INSERT INTO sessions (id, source, external_id, file_path, repo_root, git_branch, started_at,
                   ended_at, active_ms, user_turns, timeline, prs, tasks, cost_usd, last_event, ingested_at)
                 VALUES (?1, 'claude_code', ?1, '/f', '/code/pay', 'feature/pay', ?2, ?3, 0, 2, ?4, ?5, ?6, 1.5, 'turn_ended', ?3)",
                rusqlite::params![id, t0, now, tl, prs, todos],
            )
            .unwrap();
        }
        conn.execute(
            "INSERT INTO session_commits (session_id, repo_root, sha, committed_at, subject) VALUES ('a', '/code/pay', 'x', 0, 's'), ('b', '/code/pay', 'y', 0, 's')",
            [],
        )
        .unwrap();
        conn.execute("INSERT INTO pr_states (url, state, checked_at) VALUES ('https://github.com/o/r/pull/1', 'MERGED', 0)", []).unwrap();
        let cx = context(&conn).unwrap();
        let ws = crate::workstreams::workstreams(&conn, 30).unwrap();
        let w = ws
            .iter()
            .find(|w| w.branch.as_deref() == Some("feature/pay"))
            .expect("a workstream");
        let p = pulse(w, &cx);
        assert_eq!(p.total, 4);
        assert_eq!((p.proven, p.committed, p.word), (1, 1, 1));
        assert!((p.wait_hours - 1.5).abs() < 0.01, "{}", p.wait_hours);
        assert!((p.cost_week - 4.5).abs() < 0.01);
        assert!(p.mine);
        assert_eq!(p.needs.len(), 1);
        assert_eq!(p.needs[0].title, "Approve the release");
    }
}
