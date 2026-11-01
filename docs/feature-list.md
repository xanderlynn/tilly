# Tilly feature list (v0.2.0)

This is a plain list of everything Tilly does, page by page. It is written for people who will try Tilly for a while and judge it: does it do too much, has it drifted from what it was for, and is it worth having? So it lists every feature, including small and overlapping ones, and says where a feature only works after you put effort in.

In the tables, names in **bold** are what the app shows on screen. "Where" uses the path you click: page › tab › card.

## Words you will see

- **Agent**: an AI coding helper, such as Claude Code or GitHub Copilot, that writes and changes code when you ask it.
- **Session**: one conversation with an agent, from your first message to the last. Tilly reads each session from the log the agent writes on your computer.
- **Lead agent and sub-agents**: in one session, the main agent (the lead) can hand parts of the work to helper agents (sub-agents). Tilly calls the lead plus its helpers a **team**.
- **Status**: what a session is doing right now, such as **Working**, **Your turn** or **Failed**.
- **Waiting on you**: the agent has stopped until you answer a question or approve something.
- **Outcome** or **rating**: how a session ended, which you choose: **Shipped** (the work was used), **Partial**, **Abandoned** or **Redo**. Many charts depend on these ratings.
- **Success rate**: your rated sessions scored as shipped = 1, partial = ½, abandoned or redo = 0, then averaged.
- **Workstream**: a larger piece of work that spans several sessions, such as one feature branch or one GitHub issue with its sub-issues.
- **Task**: one item on an agent's to-do list, or one sub-item of an imported issue.
- **Tracker**: GitHub Issues or Azure DevOps, where teams keep their work items.
- **Rework**: work you rated shipped whose commits were reverted or fixed again within 7 days.
- **Tokens**: the units AI models charge by. **Context** is how many tokens the agent is holding in its memory at once.
- **Smart zone**: a context size (100,000 tokens unless you change it) past which agents tend to follow instructions less well.
- **Flow score**: a 1 to 5 guess at how smooth a session was: a clear first message, few corrections, a sensible size. It is a rule of thumb, not a quality measure.
- **MCP server** and **skill**: add-ons that give an agent extra tools or instructions.
- **Playbook**: the instruction files you give agents (CLAUDE.md, AGENTS.md, Copilot instructions) and your saved prompt templates.
- **Intent**: a short plan you write before handing a task to an agent, kept in the Journal.
- **Experiment**: one habit you try for a set number of days, measured against your past numbers.
- **Goal**: a target for one number, with a second "guard" number that must not get worse.
- **Retro**: a written review of your week that Claude produces on request.

## How to read the "Default" column

- **On**: works by itself once Tilly is running.
- **On, needs ratings**: appears by itself, but stays empty or shows "—" until you have rated enough sessions (often 5 per group, 40 for insights).
- **You start it**: a button or form. Nothing happens until you use it.
- **Off**: off until you turn it on.

Tilly supports three log sources: Claude Code, Copilot CLI and Copilot Chat in VS Code. It labels sessions by the app that ran them: Claude Code, the Claude app, Copilot CLI, the Copilot app, or Copilot in VS Code.

---

## Everywhere in the app

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Sidebar with seven areas | Left side | Moves between Agents, Today, Sessions, Outcomes, Habits, Usage and Improve. Areas with more than one tab show a tab bar at the top. | On |
| **Agents** badge | Sidebar | Shows how many sessions are waiting on you, in the colour of the most urgent one. | On |
| **Search** (⌘K, or Ctrl+K on Windows) | Sidebar button, or the shortcut anywhere | Jumps to any page, runs a few actions (Plan a task, Generate weekly retro, New experiment, Settings) and finds any session by words from your prompts. | You start it |
| Session details | Opens when you click any session, anywhere | One panel per session: what the agent last said or is waiting on, key numbers (active time, agents, time waited on you, cost, peak context, flow score), the team, a timeline, your prompts and its commits. | On |
| **Team** and **Timeline** in session details | Session details | Shows the session as a team: you, the lead and each sub-agent with its role and task, who never reported back, how many worked at once, and when each one was busy. Folded sections show each agent's brief and report (**Roster**) and every hand-off and message in order (**How they worked together**). | On |
| **Scheduled to run** | Session details | Lists jobs the agent set up to run later, and when. | On |
| **Signals: flow score, tools and failures** | Session details (folded) | The numbers behind the flow score: corrections, interruptions, tool errors, files edited without being read first, files edited twice, compactions (when the agent summarised its memory to keep going), and whether the work was reworked later. | On |
| **How did it go?** | Session details | Rate the session, note what you would do differently, say whether it was faster than doing it by hand, tick which running experiment it used, and add tags. | You start it |
| **Commits** | Session details | Lists commits made in the session's repository while it ran or within 30 minutes after. | On |
| **Playbooks in effect** | Session details | Shows which instruction file versions and prompt templates applied to this session. You can mark a prompt template as used. | On |
| **Pick it back up** | Session details | Shows the command that resumes the session in its tool, ready to copy. | On |
| **Go to agent** | Session details, and each waiting session in the Control center | Brings forward the window where the session runs: the Claude app, the Copilot app, VS Code on the right folder, or the exact Terminal or iTerm tab. **macOS only.** On Windows it only shows the resume command. | You start it |
| Review prompt ("Session finished") | Bottom-right pop-up | When a session finishes, asks you to rate it in one tap. At most three a day, never for a rated session. | On |
| **Plan a task** | Today (button), Habits › Journal, and Search | A form for the goal, what "done" looks like, context, task type, tool, project, expected minutes and confidence. A **Clear-ask checklist** shows what your plan is missing, and **From your history** gives advice from your past sessions. **Copy as prompt** turns it into your first message to the agent. It is also saved as a Journal intent, and the next session in that project links to it. | You start it |
| Drill-through | Most charts and tables | Clicking a bar, day, row or tile opens Sessions filtered to exactly those sessions. | On |
| Date range | Most pages | Picks the period a page covers: 7, 30 or 90 days, or All. | On (30 days) |
| **What's new** | Sidebar | Shows the release notes. A dot marks notes you haven't read. It never opens by itself. | On |
| **Update available** | Sidebar | Appears when a newer release exists and opens the update list (see Settings › Updates). | On |

## Agents › Control center

The page Tilly opens on. It answers "which agents need me right now?"

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Statuses | Every session card | Each live session gets one status from its log: **Your turn**, **Needs permission**, **Might need approval** (a guess for Claude Code, after 45 seconds with no tool result), **Failed**, **Working**, **Long task**, **Scheduled**, **Completed**, **Closed** or **Idle**. | On |
| Summary tiles | Top row | **Working**, **Awaiting you**, **Completed today**, **Sub-agents**, **Waited on you** (today, plus time while you were away) and **Your reply time** (shown after 5 replies today). Click a tile to show only that part of the board. | On |
| **Awaiting you** | Main list | Every session waiting on you, most urgent first, then longest wait. Shows the waiting time, the project and branch, and what the agent asked. | On |
| **Dismiss** | Each waiting session | Hides a session you already handled somewhere else, until the agent does something new. | You start it |
| **Parked** | Folded under Awaiting you | Sessions left waiting over 3 hours. Kept so an overnight question isn't lost, but left out of the count, the badge and the tray. | On |
| **Working** column | Board | Sessions at work, with how long, what kind of work (coding, research, running, discussion), the tool in use, the team, and a bar showing context against your smart zone. Older idle or finished sessions sit folded below (**Idle or finished earlier**). | On |
| **Scheduled** column | Board | Sessions with work set to run later, with a countdown to the next run. | On |
| **Completed today** column | Board | Sessions that finished today, with time, failed sub-agents and their rating (or **Unrated**). | On |
| Tool filter and **Teams only** | Top right | Shows one tool's sessions, or only sessions with sub-agents. | On (all tools) |
| Keyboard moves | Board | j / k or the arrow keys move between cards; Enter opens one. | On |
| **Today's activity** | Below the board | One lane per session through the day, so you can see what ran when. | On |
| **Sessions working and awaiting you, through the day** | Chart | How many sessions were working and how many waited on you, in 15-minute steps. | On |
| **How long you took to reply today** | Chart | Your reply times today, grouped from under a minute to over an hour. | On |

## Agents › Workstreams

Larger efforts that span sessions. This is where Tilly tracks all tasks and work.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Automatic workstreams | List | Groups sessions on the same feature branch, or a session whose agent kept a to-do list, into one workstream without you doing anything. Reads Claude Code to-dos and plans and Copilot CLI to-dos. (Copilot in VS Code to-do lists are not passed on yet.) | On |
| Workstream cards | List | Each card shows a progress bar (done, in progress, waiting on you), how many tasks are agent work or yours, the agents on it, and its latest update. A label says **On track**, **Done**, **Closed**, **Idle**, **Stalled** (two weeks quiet), **Out of date** (a tracker fetch failed) or what needs you. | On |
| **Active**, **All**, **Starred**, **Needs you** | Top bar | Filters the list. Active means touched in the last 3 days, starred, or needing you. | On (Active) |
| Search and range | Top bar | Finds a workstream by name, repository or branch, and limits the list to 7 days, 30 days or all. | On |
| Star | Each card and its detail page | Keeps a workstream at the top and in the Active list whatever its age. | You start it |
| **New workstream** | Top bar | Makes your own workstream with a name and the sessions you pick. A session brings its branch, so later sessions on that branch join too. | You start it |
| **Add sessions**, **Remove**, rename and delete | Workstream detail | Adds sessions to any workstream. Your own workstreams can also lose sessions and be deleted (the sessions stay). Any workstream can be renamed. | You start it |
| **Archive** | Workstream detail | Hides a workstream from Active. It stays under All. | You start it |
| **Import from tracker** | Top bar | Builds a workstream from a GitHub issue or Azure DevOps work item at any level (epic, feature, story, task, bug). Items under it, three levels deep, become its tasks. An `agent` or `human` label decides who does each. Sessions that mention it join. Uses your own `gh` or `az` sign-in. | You start it |
| Background sync and **Sync** | Workstream detail, and in the background | Imported workstreams are fetched again every 15 minutes, when you return to the window, and when opened. **Sync** fetches now. A failed fetch says why. | On (15 min; change in Settings) |
| **Tasks** tree | Workstream detail | Every task, grouped by session (and the tracker's items first, indented by level), marked **Done**, **In progress**, **Needs you**, **Blocked** or **Not started**. | On |
| Agent or **You** badge | Each task | Tilly guesses whether a task is agent work or yours (approvals, decisions, passwords, release steps, or anything an agent is waiting on you for). | On |
| **Who should do it?** | Task panel | Changes a task to agent work or yours. **Reset** goes back to Tilly's guess. | You start it |
| Label in tracker | Task panel | Adds the `agent` or `human` label to the item in GitHub or Azure DevOps so the team sees it. Only when you click. | You start it |
| **Task** panel | Workstream detail | Shows a task's status, who it is for and why, who is working on it or assigned (and if that's you), its sessions, what it waits for, and when it changed. | On |
| **Evidence** | Task panel, for done tasks | Says whether a "done" task has commits or a pull request behind it, or is "only the agent's word". | On |
| **What it took** | Workstream detail | Agent time, cost, sessions, commits, pull requests and how many shipped, for the workstream or one tracker item. | On |
| **Updates** | Workstream detail | The agents' own progress notes, newest first, for the whole workstream or one task. | On |
| **Share progress** | Workstream detail (imported only) | Drafts a progress comment for the issue (done, in progress, waiting on a person, with agent time, commits and PRs, no costs). You edit it; only **Post** sends it, as you. | You start it |

## Agents › Teams

Sessions where the lead agent handed work to sub-agents.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Summary tiles | Top row | **Working now**, **Scheduled**, **Sessions with a team** and **Reported back** (sub-agents that delivered a result). | On |
| **At work and coming up** | Card | Every sub-agent working right now and its task, plus jobs scheduled to run later. | On |
| **Recent teams** | Card | Each session with a team: its roles, a dot per agent coloured by status, how many failed to report, and tokens used. | On |
| **Roles you use** | Card | How often you use each kind of sub-agent (reviewer, explorer, tester…), how often it reports back, and its tokens. | On |

## Today

A short daily page for reviewing and planning. It deliberately shows no activity totals.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **Set up Tilly** | Top, first runs only | A checklist: which tools' logs were found, a test notification, adding the Claude Code hook, and whether to keep transcript copies. Gone once you close it. | On (once) |
| **Outcomes to confirm** | Card | Sessions whose pull requests or commits suggest how they ended ("look shipped", "look abandoned"). **Confirm all** rates them in one click. Nothing counts until you confirm. | On |
| **This week** | Card, Mondays and Fridays | This week against last: what shipped, cost, time agents waited on you, and workstreams finished. | On |
| **While you were away** | Card, after 30+ minutes away | What finished, failed or started waiting on you since you last looked. | On |
| Waiting banner | Top | "N agents awaiting you", with a link to the Control center. | On |
| **Rate recent sessions** | Card | Finished, unrated sessions from the last 3 days. Rate each in one tap and say if it was faster than by hand. | On |
| **Running experiments** | Card | Your running experiments, with the starting number, the current number and the end date. | On |
| **Goals this week** | Card | Each goal, whether it's on target, and whether its guard number is slipping. | On (empty until you add goals) |
| **Planned tasks** | Card | Open plans from the Journal and whether a session is linked yet. | On (empty until you plan) |
| **Unusual sessions (last 2 weeks)** | Card | Sessions that stand out (much longer, costlier or rockier than usual), with the reason. | On |
| **Worth a look** | Card | The top three insights from Outcomes. | On, needs ratings |

## Sessions

Every session from every tool.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Session table | Main | Every session with tool, project, branch, kind of work, sub-agent count, start time, active time, prompts, interruptions, commits, cost and rating. Click a column to sort. | On |
| Search | Top | Searches every prompt you wrote, plus titles, projects and branches. | On |
| Filters | Top | Tool, outcome (including **Unrated**) and kind of work (feature, bugfix, troubleshooting, refactor, tests, docs, research, infra, review, other). The kind is guessed from your first prompt. | On |
| **24h** range | Top right | Adds a last-24-hours view to the usual ranges. | On |
| **Showing:** chip | Top | Shows which drill-through filter is applied, with a button to clear it. | On |
| Unusual flag | Next to a title | A flag on sessions that stand out, with the reason on hover. | On |
| **Export CSV** | Top | Saves the current list as a spreadsheet file in Downloads. | You start it |
| **Show … more** button | Bottom | Draws 100 sessions at a time so long lists stay fast. | On |

## Outcomes › Summary

The tab is called **Summary**; the page title says **Overview**.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Summary tiles | Top | **Success rate**, **Shipped**, **Commits**, **Agents waited on you**, **Sessions**, **Interruptions / session**, **Tool error rate** and **Spend**. Each shows the change from the previous period, a 12-week trend line, and your usual range. | On (success needs ratings) |
| **Insights** | Card | Short findings about your work, such as whether longer first prompts ship more often or whether the time of day matters, with the sessions behind them. Fourteen rules. A finding only shows when the difference is statistically real, and needs 40 rated sessions. | On, needs ratings |
| **Unrated sessions** | Card | Sessions you haven't rated yet, to rate from here. | On |
| **Why sessions go wrong** | Card | Abandoned, redone or reworked sessions grouped by their clearest cause, each with advice. | On, needs ratings |
| **Sessions per day** | Chart | Sessions each day, shipped ones highlighted. Click a day for its sessions. | On |
| **Active time per day** | Chart | Minutes of agent work each day. | On |
| **By tool** | Card | Active hours, sessions and results per tool. | On |
| **By project** | Card | The same, per project. | On |

## Outcomes › Progress

"Did I get better?" over the last year. Needs two months of history.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Headline | Top | One sentence on whether your year got better, worse or stayed flat. | On |
| Month charts | Cards | **Success**, **Cost per shipped session**, **Typical reply** and **Hours agents waited on you**, month by month. | On (success needs ratings) |
| **What you finished** | Card | Workstreams you finished, by quarter, with tasks, sessions, time and cost. | On |
| **What pays off** | Cards | Success and average cost **By sub-agent team size**, **By app** and **By kind of work**. Groups under 20 rated sessions are greyed out. | On, needs ratings |

## Outcomes › Delivery & reality

The tab is called **Delivery & reality**; the page title says **Scorecard**. It is about output, not activity.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Output tiles | Top | **Sessions → commits**, **Commits linked**, **Lines changed**, **Shipped sessions**, **Cost per commit**, **Active time per commit**, **Cost per shipped session** and **Sessions**. Needs sessions run in a git repository. | On |
| **Weekly output** | Chart | Each week's sessions split into shipped, committed but not shipped, and other. | On |
| **By tool** and **By repository** | Cards | Output per tool and per repository. | On |
| **Reality check** | Card | Checks how you feel against what happened: **Shipped, then reworked**, **Your estimates** (actual ÷ expected time from the Journal), **Agent : you** (agent hours against hours it waited on you), and **Felt faster**, with a table comparing sessions you called faster with how often they were reworked. | On, needs ratings |
| **Delegation fit** | Card | A grid of kind of work × tool that says **Delegate**, **Delegate with structure**, **Consider doing it yourself** or **Not enough data**, from your own success and rework. Needs 5 rated sessions per cell. | On, needs ratings |

## Habits › Patterns

How and when you work, and whether it's improving.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **Your attention** | Top card | Splits the time agents waited on you into replying (waits up to 30 minutes) and away (meetings, the night), by hour of day, with the projects that wait most and one tip. | On |
| **Activity over the last year** | Card | A calendar of active minutes per day. Click a day for its sessions. | On |
| **When you start sessions** | Card | A weekday × hour grid of when you start sessions. | On |
| **Flow score** | Card | Your average flow score and its three parts: **Clear ask**, **Steering** and **Scope**. | On |
| **What you delegate** | Card | Per kind of work: sessions, average time, flow score and success. | On (success needs ratings) |
| **What the agents do** | Card | The share of reading, editing, shell commands and other tool calls, reads per edit, and the most used tools. | On |
| **Learning curve** | Card | Five small weekly charts: **Success**, **Re-edit rate**, **Blind-edit rate**, **Corrections / session** and **Flow score**. Dotted lines mark weeks you changed an instruction file or prompt template. | On |
| **Then vs now** | Card | Your first 30 days against your last 30. Needs two months of data. | On |
| **Context and delegation** | Card | Compares sessions with and without compaction, and with sub-agents. | On |
| **Tool reliability and your vetoes** | Card | Per tool: calls, failures and how often you rejected it, with a hint to turn rejections into instruction-file rules. | On |
| **Longest sessions** | Card | Your longest sessions by active time. | On |

## Habits › Execution

What agents spend time on, and how you run sessions.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **Where agent time goes** | Card | Agent hours split into **coding**, **research**, **running** and **discussion**, overall, per tool and per week. | On |
| **How you run sessions** | Card | Compares one-shot, planned and iterative sessions on prompts, time, tokens, corrections, rework and success. | On (success needs ratings) |
| **Context and the smart zone** | Card | How many sessions grew past your smart zone or were compacted, success inside and past it, and a chart of peak context per session. | On |

## Habits › Toolkit

The agent roles, tools, MCP servers and skills you use.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Summary tiles | Top | Sessions, and how many **Agents**, **Tools**, **MCP servers** and **Skills** you used, each with the top one. | On |
| Kind and tool switches | Top | Picks what to list (agents, tools, MCP servers or skills) and which tool's sessions to count. | On |
| **Sessions using each, per week** | Chart | Weekly use of your top five. | On |
| **Against outcomes** | Table | For each item: sessions, uses, a 12-week trend, success with it and without it, the difference, and rework with and without. | On, needs ratings |

## Habits › Journal

Write down what you expect before delegating; record what happened after.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **Plan before you delegate** | Card | Opens **Plan a task** (see "Everywhere"). | You start it |
| **Open intents** | Card | Plans in flight. Link a session (or let it link itself), then close each with an outcome, the actual minutes and "What surprised you?". Delete if not needed. | You start it |
| **Calibration** | Section | After closing a few plans: your success rate, actual ÷ expected time, average confidence, and tables **By task type**, **By confidence** and **By tool**. | On (empty until you close plans) |
| **History** | Card | Closed plans with expected and actual time and your notes. **Reopen** brings one back. | On |

## Habits › Playbooks

The instructions you give agents, with versions.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **Instruction files** | Section | Finds CLAUDE.md, AGENTS.md and Copilot instruction files in your projects and reads past versions from git history. Each session is linked to the version in effect when it ran. | On |
| Version table | Each playbook (click to open) | Per version: sessions, success (with change from the version before), prompts, interruptions, tool errors, commits and rework. Click a version to read it. | On (success needs ratings) |
| **Prompt templates** | Section, and the **Prompt template** button | Save, edit and delete prompts you reuse. Editing makes a new version. Sessions whose first prompt starts with the template link to it, or link them by hand in session details. | You start it |

## Usage

Tokens and spend.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **Tokens** / **Cost** switch | Top | Shows the daily chart in tokens or dollars. | On (tokens) |
| Summary tiles | Top | **Tokens in range**, **Tokens per session**, **Tokens per shipped session**, **Cache hit rate**, **Spend in range**, **This month** (with pace and budget), **Spend per shipped session** and **Saved by caching**. | On |
| **This month's spend** | Chart | Spend so far against a straight-line pace for the month, and your budget if you set one. | On |
| **Tokens per day by tool** / **Spend per day by tool** | Chart | Daily use per tool. Click a day for its sessions. | On |
| **Cache hit rate per day** | Chart | How much of each day's input came from the cheaper cache. | On |
| **Tokens per day (excluding cache reads)** | Chart | Input, cache writes and output per day. | On |
| **Model comparison** | Table | Per model: sessions, spend, cost and tokens per session, prompts, time, flow score and success. | On (success needs ratings) |
| Cost source | All money figures | Claude Code costs are what Claude Code records. Copilot costs are always estimates at API prices. On a subscription, amounts show as ≈ (see Settings › How you pay for agents). | On |

## Improve › Weekly retro

A written review of your week by Claude, on request. This is the one feature that sends data off your computer by design.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **This week** | Top card | The same this-week-against-last card as on Today. | On |
| **Generate retro** | Card | Claude reviews the last 7, 14 or 30 days: what worked, where time leaked, and three experiments to try. It follows up on last time's experiments. Uses your installed `claude` tool and subscription, or an Anthropic API key. | You start it |
| **Your reflection first (optional)** | Card | Write your own view before Claude's, so the review starts from it. | You start it |
| **Preview what's sent** | Card | Shows the exact text that would go to Claude (numbers, session titles, the first 300 characters of opening prompts, your notes). | You start it |
| **Adopt an experiment** | Under each retro | Turns a suggested experiment into a real one in one step. | You start it |
| **History** | Card | Past retros to reread or delete. | On |

## Improve › Experiments & goals

Change one habit and measure it.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **Goals** | Section | Up to three goals. Each has a target and a **Guard** number that warns when hitting the goal makes something else worse. **retire** removes one. | You start it |
| **New experiment** | Button | Name the habit, why it should help, the number to watch, which kind of work and tool, and how many days (3 to 60). The starting number is your previous four weeks, locked when you start. | You start it |
| Experiment card | **Running** and **Finished** | Shows **Baseline**, **Now**, **Reading** (better, worse, no clear change, too early) and **Applied** (how many sessions you tagged as using the habit). End it with **Keep the habit**, **Drop it** or **+1 week**, plus a note. | You start it |

## Settings

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| **Appearance** | Card | Six ready-made **Skins**, eight **Themes** (dark and light), seven **Accent** colours, **Density** and **Corners**. | On (Default skin) |
| **Status sounds and images** | Card | Per status: an image, a sound (built-in tone or your own WAV or Ogg file), a volume and a desktop notification switch. Also **Master volume**, **Mute all sounds**, **Quiet hours** and **Only in the background**. Out of the box, Your turn, Needs permission, Might need approval and Failed play a sound and notify; Completed plays a sound only. | On (quiet hours off) |
| **Sources** | Card | Each tool: whether its logs were found, where, how many sessions, and a **Track** switch. **Scan now** and **Re-parse everything** read logs again. **Also read logs from another folder** adds extra folders. | On (all tools tracked) |
| **Weekly retro** | Card | Choose the engine (Claude Code CLI or Anthropic API), the `claude` path, the model, and the API key (kept in the system keychain, never in the database). | On (Claude Code CLI) |
| **Behaviour** | Card | **Smart-zone limit (tokens)**, **Monthly AI budget (USD)**, **Notify me when an agent starts waiting on me**, and **Keep a copy of raw transcripts**. | Smart zone 100k, no budget, notify on, copies on |
| **Updates** | Card | **Choose version** lists newer releases, the installed one and the one before. Picking one downloads it, checks its signature, installs and restarts, so it also rolls back. **Check for updates automatically** looks on launch and daily. | On (auto-check) |
| **How you pay for agents** | Card | **Pay per use (API)** or **Subscription**. On a subscription, dollar amounts show as ≈, what the work would cost at API prices. | Pay per use |
| **Storage and history** | Card | Shows how much space Tilly uses. **Keep session detail for** (90 days to forever) and **Keep transcript copies for** (30 days to forever). Session summaries are always kept. | Detail 180 days, copies 90 days |
| **Claude Code permission prompts** | Card | Adds (or removes) one hook in Claude Code's settings so Tilly sees every permission prompt exactly, Bash included, instead of guessing. Keeps a backup of the old settings file. | Off |
| **Workstreams** | Card | **Sync imported items**: Off, 5 min, 15 min or Hourly. The same setting turns pull-request checks on or off. | 15 min |
| **Data** | Card | Shows where the database lives and opens the log file for problem reports. | On |
| **About and licenses** | Card | Tilly's licence and the notices of the open-source parts it uses. | On |

## Background (no page of its own)

These run whether or not the window is open.

| Feature | Where | What it does | Default |
| --- | --- | --- | --- |
| Tray (menu-bar) app | Windows system tray, macOS menu bar | Tilly keeps running when you close the window, so it can keep alerting. The tray menu lists up to five sessions waiting on you; pick one to open it. **Quit Tilly** stops it. | On |
| Start in the tray | Command-line option | Started with `--background`, Tilly goes straight to the tray. It does not add itself to start at login. | You start it |
| Live log reading | Background | Watches the agents' log folders and updates within seconds, reading only new lines. | On |
| Desktop notifications | Background | Says what the agent wants. Repeats every 15 minutes, up to three times, while it still waits. Clicking one opens the session. More than three at once are folded into "and N more". | On |
| Alert sounds | Background | Plays the sound set for each status change. Bursts are merged into one sound. | On |
| Exact permission prompts (Claude Code hook) | Background, once added in Settings | Receives a message from Claude Code the moment it asks for permission. Copilot logs these itself, so it needs no hook. | Off |
| Transcript copies | Background | Keeps its own copy of each log, because Claude Code deletes its logs after 30 days. Copies are compressed after a week. | On |
| History clean-up | Background, daily | Applies the Storage and history limits. | On |
| Tracker sync | Background | Fetches imported workstreams again on schedule, one at a time. | On (15 min) |
| Pull-request checks | Background | Asks GitHub (through `gh`) whether recent sessions' pull requests merged. A merged one suggests **Shipped**; all closed suggests **Abandoned**. Needs confirming on Today. | On |
| Commit linking | Background | Links your commits to the session that made them: same repository, during the session or 30 minutes after. Commits an agent signed as co-author count up to four hours after. | On |
| Playbook versions | Background | Reads instruction-file history from git and links each session to the version in effect. | On |
| Plan linking | Background | Links an open plan to the next session in its project. | On |
| Secret removal | Background | Removes pasted API keys, tokens, passwords and private keys from prompts, titles and replies before storing or sending them. | On |
| Update checks | Background | Fetches GitHub's public release list on launch and daily. | On |
| Error log | Background | Writes background errors and failed actions to a log file. | On |
| Move from old names | First launch | Moves data and a saved API key from Tilly's earlier names, Governess and Execution Ledger. | On |
| Proxy support | Background | Uses the computer's proxy settings, for company networks. | On |

---

## What Tilly is for

Tilly is for one person who hands real coding work to AI agents. It started with two questions. First: right now, which agents are stuck waiting for me? Tilly answers that with the Control center, the tray, sounds and notifications, so no agent sits idle unnoticed. Second: over time, am I getting better at working with agents? Tilly answers that by asking you to rate how sessions ended, then showing which habits lead to work that ships and stays shipped, and letting you test one change at a time. Since then it has grown a third job: tracking larger pieces of work across sessions (Workstreams, including GitHub and Azure DevOps items) and showing agent work as a team of lead and helpers. Everything stays on your computer, except a retro you ask for, tracker syncing, and update checks. Most of the "over time" pages only become useful after you have rated a good number of sessions; without ratings, Tilly is mostly a live status board and a usage meter.

## How many features each page has

Counted as the rows in the tables above.

| Page | Features |
| --- | --- |
| Everywhere in the app | 18 |
| Agents › Control center | 13 |
| Agents › Workstreams | 19 |
| Agents › Teams | 4 |
| Today | 11 |
| Sessions | 8 |
| Outcomes › Summary | 8 |
| Outcomes › Progress | 4 |
| Outcomes › Delivery & reality | 5 |
| Habits › Patterns | 11 |
| Habits › Execution | 3 |
| Habits › Toolkit | 4 |
| Habits › Journal | 4 |
| Habits › Playbooks | 3 |
| Usage | 8 |
| Improve › Weekly retro | 6 |
| Improve › Experiments & goals | 3 |
| Settings | 12 |
| Background | 18 |
| **Total** | **162** |

That is 7 areas, 17 tabs and the Settings page. Habits alone has five tabs and 25 features.

## Features that overlap or repeat

1. **Rating a session can be done in five places**: Today › **Rate recent sessions**, the "Session finished" pop-up, session details › **How did it go?**, Today › **Outcomes to confirm**, and closing a plan in Habits › Journal (which asks for an outcome again). Outcomes › Summary › **Unrated sessions** and the Sessions **Unrated** filter are two more ways to find what's unrated.
2. **"Time agents waited on you" is shown in at least eight places**: Control center tiles, Today's **This week**, Habits › Patterns › **Your attention**, Outcomes › Summary tile, Outcomes › Progress chart, Delivery & reality › **Agent : you**, session details, and the session timeline.
3. **The This week card** appears on both Today (Mondays and Fridays) and Improve › Weekly retro.
4. **Success broken down by something** appears in at least nine tables: What you delegate, How you run sessions, Toolkit's Against outcomes, Model comparison, What pays off (three tables), Delegation fit, Journal calibration and Playbook versions.
5. **By tool / By project** tables are on both Outcomes › Summary and Outcomes › Delivery & reality.
6. **Progress over time** is shown four ways: Outcomes › Progress (monthly), Patterns › **Learning curve** (weekly), Patterns › **Then vs now**, and the 12-week trend lines on Summary tiles.
7. **Sub-agents and teams** show up in Agents › Teams, the Control center (Sub-agents tile, Teams only filter), session details (Team), Toolkit › Agents, Teams › **Roles you use** (close to Toolkit › Agents), Progress › **By sub-agent team size**, and Patterns › **Context and delegation**.
8. **Context and the smart zone** appear in the Control center cards, Execution › **Context and the smart zone**, Patterns › **Context and delegation**, and session details.
9. **Insights and odd sessions** come in four forms: Summary › **Insights**, Today › **Worth a look** (top three of the same), Today › **Unusual sessions** and the flags in Sessions, and Summary › **Why sessions go wrong**.
10. **Cost per shipped work** is on Usage (spend and tokens per shipped session), Delivery & reality (cost per shipped session, cost per commit), Progress (monthly chart) and each workstream's **What it took**.
11. **Rework** is measured in Reality check, How you run sessions, Toolkit, Playbook versions, Delegation fit, Why sessions go wrong and session details.
12. **Tool errors** are on the Summary tile, Patterns › **Tool reliability and your vetoes**, Playbook versions and session details.
13. **Finished workstreams** are listed in Progress › **What you finished**, the **This week** card and as **Done** cards in Workstreams.
14. **Plans** appear as Today › **Planned tasks** and Journal › **Open intents** (same list), and the Plan a task form opens from three places.
15. **Notifications have two switches**: Settings › Behaviour › **Notify me when an agent starts waiting on me** (turns all off) and a **Notify** switch per status in **Status sounds and images**.
16. **Transcript copies are set in three places**: Behaviour › **Keep a copy of raw transcripts**, Storage and history › **Keep transcript copies for**, and the **Set up Tilly** checklist.
17. **The Claude Code hook** can be added from Settings and from **Set up Tilly**.
18. **Updates** open the same list from the sidebar button and from Settings › Updates.
19. **Two tabs have a different title on the page**: **Summary** shows "Overview" and **Delivery & reality** shows "Scorecard". This is a naming mismatch rather than a repeat, but it makes the overlap above harder to see.
