//! The Wall: one workstream's every task on one screen. Rows are its
//! features (an imported epic's top-level items) or, for a workstream built
//! from sessions, its sessions. Each task is a cell with who does it (agent
//! or person), its phase (build, review, release or decide) and its state,
//! proof included. Alongside: what needs you here, where time is going, and
//! the stories holding up the most.

use std::collections::{HashMap, HashSet};

use anyhow::Result;
use rusqlite::Connection;
use serde::Serialize;

use crate::live::{self, Group};
use crate::pulse::{self, Need};
use crate::tasks::TaskStatus;
use crate::workstreams::{self, TaskKind, Workstream, WsTask};

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Build,
    Review,
    /// Release steps and decisions share the last column.
    Release,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CellState {
    /// Done with a merged pull request.
    Merged,
    /// Done with commits but no merged pull request.
    Committed,
    /// A tracker item closed by a person.
    Confirmed,
    /// Done on the agent's word only.
    Word,
    Working,
    /// Waiting on you: your step, or an agent waiting on you.
    You,
    /// Waiting on someone else's step.
    Others,
    Stuck,
    Todo,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Cell {
    pub key: String,
    pub title: String,
    pub human: bool,
    pub phase: Phase,
    pub state: CellState,
    pub mine: bool,
    /// The story or bug it belongs to (its parent item), or its session.
    pub item: String,
    /// Hours it has been in its current waiting state (you, others, stuck,
    /// review), when Tilly knows when it started; 0 otherwise.
    pub age_hours: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WallItem {
    pub key: String,
    pub title: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WallRow {
    pub key: String,
    pub title: String,
    /// Rows this one waits on: one of its tasks is blocked by a task there.
    pub waits_on: Vec<String>,
    pub cells: Vec<Cell>,
    pub items: Vec<WallItem>,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Lost {
    /// Hours agents waited on you in the last two weeks.
    pub waiting_on_you: f64,
    /// Summed age, in hours, of what's open now: others' steps, stuck, in review.
    pub waiting_on_others: f64,
    pub stuck: f64,
    pub in_review: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Delay {
    pub item: String,
    pub row: String,
    /// What most of its delay is: "you", "others", "stuck" or "review".
    pub cause: &'static str,
    pub hours: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Wall {
    pub key: String,
    pub title: String,
    /// "feature" rows for an imported epic, "session" rows otherwise.
    pub rows_are: &'static str,
    pub rows: Vec<WallRow>,
    /// What needs you here, most work freed first.
    pub needs: Vec<Need>,
    pub lost: Lost,
    pub delays: Vec<Delay>,
}

/// A person's step with these words is a release step or a decision.
const RELEASE_WORDS: &[&str] = &[
    "decide",
    "decision",
    "approve",
    "approval",
    "sign off",
    "sign-off",
    "release",
    "deploy",
    "production",
    "rollout",
    "roll out",
];

/// Agent work in a session with an open pull request is in review.
const REVIEW_WORDS: &[&str] = &["review", "pull request", "code review"];

pub fn wall(conn: &Connection, key: &str, days: i64) -> Result<Wall> {
    let w = workstreams::workstream(conn, key, days)?;
    let cx = pulse::context(conn)?;
    let p = pulse::pulse(&w, &cx);
    let pr_state: HashMap<String, String> = conn
        .prepare("SELECT url, state FROM pr_states")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(build(
        &w,
        &pr_state,
        p.needs,
        p.wait_hours + p.wait_hours_prev,
        crate::util::now_ms(),
    ))
}

fn build(
    w: &Workstream,
    pr_state: &HashMap<String, String>,
    needs: Vec<Need>,
    waited_hours: f64,
    now: i64,
) -> Wall {
    let has_items = w.tasks.iter().any(|t| t.session_id.is_empty());
    let by_key: HashMap<&str, &WsTask> = w.tasks.iter().map(|t| (t.key.as_str(), t)).collect();
    let parents: HashSet<&str> = w.tasks.iter().filter_map(|t| t.parent.as_deref()).collect();
    let sessions: HashMap<&str, _> = w.sessions.iter().map(|s| (s.id.as_str(), s)).collect();
    let done = |s: TaskStatus| matches!(s, TaskStatus::Done | TaskStatus::Cancelled);

    // The row a task sits in: its top-level item, or its session.
    let top = |t: &WsTask| -> String {
        if !has_items {
            return t.session_id.clone();
        }
        let mut cur = t;
        while let Some(p) = cur.parent.as_deref().and_then(|p| by_key.get(p)) {
            cur = p;
        }
        cur.key.clone()
    };
    let leaves: Vec<&WsTask> = w
        .tasks
        .iter()
        .filter(|t| (!has_items || t.session_id.is_empty()) && !parents.contains(t.key.as_str()))
        .collect();
    let hours_since = |at: Option<i64>| {
        at.map(|a| (now - a).max(0) as f64 / 3_600_000.0)
            .unwrap_or(0.0)
    };

    let mut rows: Vec<WallRow> = vec![];
    let mut row_of: HashMap<String, usize> = HashMap::new();
    let mut item_seen: HashSet<String> = HashSet::new();
    let mut task_row: HashMap<&str, String> = HashMap::new();
    for t in &leaves {
        let r = top(t);
        task_row.insert(t.key.as_str(), r.clone());
        let idx = *row_of.entry(r.clone()).or_insert_with(|| {
            let title = if has_items {
                if r == t.key && t.parent.is_none() {
                    // A top-level item with nothing under it shares one row.
                    "Other items".to_string()
                } else {
                    by_key
                        .get(r.as_str())
                        .map(|x| x.title.clone())
                        .unwrap_or_default()
                }
            } else {
                sessions
                    .get(r.as_str())
                    .and_then(|s| s.title.clone())
                    .unwrap_or_else(|| "A session".into())
            };
            rows.push(WallRow {
                key: r.clone(),
                title,
                waits_on: vec![],
                cells: vec![],
                items: vec![],
            });
            rows.len() - 1
        });
        let item = if has_items {
            t.parent.clone().unwrap_or_else(|| t.key.clone())
        } else {
            t.session_id.clone()
        };
        if item_seen.insert(item.clone()) {
            let title = by_key
                .get(item.as_str())
                .map(|x| x.title.clone())
                .or_else(|| sessions.get(item.as_str()).and_then(|s| s.title.clone()))
                .unwrap_or_else(|| t.title.clone());
            rows[idx].items.push(WallItem {
                key: item.clone(),
                title,
            });
        }

        let ids = linked(t);
        let prs: Vec<&String> = ids
            .iter()
            .filter_map(|id| sessions.get(id))
            .flat_map(|s| s.prs.iter())
            .collect();
        let merged = prs
            .iter()
            .any(|p| pr_state.get(p.as_str()).is_some_and(|s| s == "MERGED"));
        let open_pr = prs
            .iter()
            .any(|p| pr_state.get(p.as_str()).is_none_or(|s| s == "OPEN"));
        let commits = ids
            .iter()
            .filter_map(|id| sessions.get(id))
            .any(|s| s.commits > 0);
        let awaiting = ids.iter().filter_map(|id| sessions.get(id)).find(|s| {
            s.status.group() == Group::Awaiting && now - s.ended_at < live::LIVE_WINDOW_MS
        });
        let human = t.kind == TaskKind::Human;
        let reason = t.reason.as_deref().unwrap_or("").to_lowercase();
        let title = t.title.to_lowercase();
        let release = |text: &str| RELEASE_WORDS.iter().any(|w| text.contains(w));
        let phase = if human && (release(&reason) || release(&title)) {
            Phase::Release
        } else if REVIEW_WORDS.iter().any(|w| title.contains(w))
            || (!human && open_pr && !done(t.status))
        {
            Phase::Review
        } else {
            Phase::Build
        };
        let blocked = t.status == TaskStatus::Blocked
            || t.blocked_by
                .iter()
                .any(|k| by_key.get(k.as_str()).is_some_and(|o| !done(o.status)));
        let yours = !t.session_id.is_empty() || t.mine || t.agent.is_none();
        let (state, age_hours) = match t.status {
            TaskStatus::Done if merged => (CellState::Merged, 0.0),
            TaskStatus::Done | TaskStatus::Cancelled if t.session_id.is_empty() => {
                (CellState::Confirmed, 0.0)
            }
            TaskStatus::Done if commits => (CellState::Committed, 0.0),
            TaskStatus::Done | TaskStatus::Cancelled => (CellState::Word, 0.0),
            _ if awaiting.is_some() => (CellState::You, hours_since(awaiting.map(|s| s.ended_at))),
            _ if human && yours => (CellState::You, hours_since(t.updated_at)),
            _ if human => (CellState::Others, hours_since(t.updated_at)),
            _ if blocked => (CellState::Stuck, hours_since(t.updated_at)),
            TaskStatus::InProgress => (
                CellState::Working,
                if phase == Phase::Review {
                    hours_since(t.updated_at)
                } else {
                    0.0
                },
            ),
            _ => (CellState::Todo, 0.0),
        };
        rows[idx].cells.push(Cell {
            key: t.key.clone(),
            title: t.title.clone(),
            human,
            phase,
            state,
            mine: t.mine || !t.session_id.is_empty(),
            item,
            age_hours,
        });
    }

    // Which rows wait on which: a task blocked by a task in another row.
    let titles: HashMap<String, String> = rows
        .iter()
        .map(|r| (r.key.clone(), r.title.clone()))
        .collect();
    for row in &mut rows {
        let mut waits: Vec<String> = vec![];
        for t in leaves
            .iter()
            .filter(|t| task_row.get(t.key.as_str()) == Some(&row.key))
        {
            for b in &t.blocked_by {
                if let Some(other) = task_row.get(b.as_str())
                    && other != &row.key
                    && by_key.get(b.as_str()).is_some_and(|o| !done(o.status))
                    && let Some(name) = titles.get(other)
                    && !waits.contains(name)
                {
                    waits.push(name.clone());
                }
            }
        }
        row.waits_on = waits;
    }

    let mut lost = Lost {
        waiting_on_you: waited_hours,
        ..Default::default()
    };
    let mut per_item: HashMap<(String, String), [f64; 4]> = HashMap::new();
    for row in &rows {
        for c in &row.cells {
            let slot = match c.state {
                CellState::You => 0,
                CellState::Others => 1,
                CellState::Stuck => 2,
                CellState::Working if c.phase == Phase::Review => 3,
                _ => continue,
            };
            match slot {
                1 => lost.waiting_on_others += c.age_hours,
                2 => lost.stuck += c.age_hours,
                3 => lost.in_review += c.age_hours,
                _ => {}
            }
            per_item
                .entry((row.title.clone(), c.item.clone()))
                .or_default()[slot] += c.age_hours;
        }
    }
    let item_title: HashMap<&str, &str> = rows
        .iter()
        .flat_map(|r| r.items.iter().map(|i| (i.key.as_str(), i.title.as_str())))
        .collect();
    let mut delays: Vec<Delay> = per_item
        .into_iter()
        .filter_map(|((row, item), h)| {
            let total: f64 = h.iter().sum();
            if total <= 0.0 {
                return None;
            }
            let (i, _) = h
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.total_cmp(b.1))
                .unwrap();
            Some(Delay {
                item: item_title.get(item.as_str()).unwrap_or(&"").to_string(),
                row,
                cause: ["you", "others", "stuck", "review"][i],
                hours: total,
            })
        })
        .collect();
    delays.sort_by(|a, b| b.hours.total_cmp(&a.hours));
    delays.truncate(5);

    Wall {
        key: w.key.clone(),
        title: w.title.clone(),
        rows_are: if has_items { "feature" } else { "session" },
        rows,
        needs,
        lost,
        delays,
    }
}

/// The sessions a task was worked in: an item's linked sessions, or a todo's own.
fn linked(t: &WsTask) -> Vec<&str> {
    if t.session_id.is_empty() {
        t.sessions.iter().map(String::as_str).collect()
    } else {
        vec![t.session_id.as_str()]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::trackers::{Epic, Item};

    #[test]
    fn lays_out_a_big_imported_epic_by_feature() {
        let conn = crate::db::open_in_memory().unwrap();
        // 12 features, each with stories, each with tasks: 1,700 tasks in all.
        let mut items = vec![];
        let mut n = 0;
        for f in 0..12 {
            let fk = format!("f{f}");
            items.push(Item {
                key: fk.clone(),
                title: format!("Feature {f}"),
                status: TaskStatus::InProgress,
                depth: 0,
                ..Default::default()
            });
            for s in 0..12 {
                let sk = format!("f{f}s{s}");
                items.push(Item {
                    key: sk.clone(),
                    title: format!("Story {f}.{s}"),
                    status: TaskStatus::Pending,
                    parent: Some(fk.clone()),
                    depth: 1,
                    ..Default::default()
                });
                let tasks = if f * 12 + s < 1700 % 144 { 12 } else { 11 };
                for k in 0..tasks {
                    if n == 1700 {
                        break;
                    }
                    let status = if k % 3 == 0 {
                        TaskStatus::Done
                    } else if k % 7 == 1 {
                        TaskStatus::Blocked
                    } else {
                        TaskStatus::Pending
                    };
                    let labels = if k == 5 {
                        vec!["human".to_string()]
                    } else {
                        vec![]
                    };
                    items.push(Item {
                        key: format!("t{n}"),
                        title: if k == 4 {
                            "Review the change".into()
                        } else {
                            format!("Task {n}")
                        },
                        status,
                        labels,
                        mine: k == 5 && f == 2,
                        parent: Some(sk.clone()),
                        depth: 2,
                        ..Default::default()
                    });
                    n += 1;
                }
            }
        }
        assert_eq!(n, 1700);
        let epic = Epic {
            title: "Checkout v2".into(),
            kind: "Epic".into(),
            url: "https://dev.azure.com/o/p/_workitems/edit/1".into(),
            status: TaskStatus::InProgress,
            items,
            needles: vec![],
            numbers: vec![],
            repo: None,
        };
        let key = workstreams::import(&conn, &epic, "https://dev.azure.com/o/p/_workitems/edit/1")
            .unwrap();
        let wall = wall(&conn, &key, 30).unwrap();
        assert_eq!(wall.rows_are, "feature");
        assert_eq!(wall.rows.len(), 12);
        assert_eq!(wall.rows.iter().map(|r| r.cells.len()).sum::<usize>(), 1700);
        assert_eq!(wall.rows[0].items.len(), 12);
        let cells: Vec<&Cell> = wall.rows.iter().flat_map(|r| &r.cells).collect();
        // Closed tracker items are confirmed by a person; blocked ones stuck.
        assert!(
            cells
                .iter()
                .filter(|c| c.state == CellState::Confirmed)
                .count()
                > 500
        );
        assert!(cells.iter().any(|c| c.state == CellState::Stuck));
        assert!(cells.iter().any(|c| c.phase == Phase::Review));
        assert!(
            cells.iter().all(|c| c.phase != Phase::Release),
            "no release steps in this epic"
        );
        // Human items: yours when assigned to you or nobody.
        assert!(cells.iter().any(|c| c.human && c.state == CellState::You));
    }
}
