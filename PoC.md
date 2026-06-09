# Classroom Automation Middleware Concept

## 1. Simple Explanation

We want to build a middleware system that automatically controls classroom AC and lights based on the class schedule.

The system will check:

```text
Is there a class in this room?
```

Then decide:

```text
Should the AC and lights be ON or OFF?
```

After that, it checks the actual device condition:

```text
Are the AC and lights already ON or OFF?
```

If the actual condition is different from the expected condition, the middleware sends a command to the building automation API.

---

## 2. High-Level Diagram

```text
+---------------------+
| Class Schedule DB   |
| Room, time, class   |
+----------+----------+
           |
           v
+-----------------------------+
| Automation Middleware       |
|                             |
| 1. Read schedule            |
| 2. Decide desired state     |
| 3. Check actual state       |
| 4. Send command if needed   |
| 5. Store log                |
+-------------+---------------+
              |
              v
+-----------------------------+
| Building Automation API     |
|                             |
| - Turn AC ON/OFF            |
| - Turn light ON/OFF         |
| - Run scenario              |
| - Get status                |
+-------------+---------------+
              |
              v
+-----------------------------+
| Classroom Devices           |
| AC, light, sensors/status   |
+-----------------------------+
```

---

## 3. The Main Idea

The middleware should not blindly send commands every few minutes.

Instead, it should compare:

```text
Desired State vs Actual State
```

Example:

```text
Room A101
Class exists now
Desired state: AC ON, Light ON

Actual state: AC OFF, Light OFF

Action:
Send command to turn ON
```

Another example:

```text
Room A101
Class exists now
Desired state: AC ON, Light ON

Actual state: AC ON, Light ON

Action:
Do nothing
```

This prevents duplicate or unnecessary API calls.

---

## 4. Simple Process Flow

```text
Start
  |
  v
Read class schedule
  |
  v
Check current time
  |
  v
Is there class in the room?
  |
  +-- Yes ----------------+
  |                       |
  v                       |
Desired state = ON        |
  |                       |
  v                       |
Check actual state        |
  |                       |
  v                       |
Is actual state already ON?
  |
  +-- Yes --> Do nothing
  |
  +-- No  --> Send ON scenario
```

For OFF condition:

```text
Class finished
  |
  v
Check if another class exists soon
  |
  +-- Yes --> Keep room ON
  |
  +-- No  --> Desired state = OFF
                  |
                  v
              Send OFF scenario if needed
```

---

## 5. Scenario Usage

The API has a scenario feature. This is useful because one scenario can contain multiple device commands.

Instead of sending this:

```text
1. Turn AC ON
2. Turn light ON
```

The middleware can send this:

```text
Run scenario: CLASSROOM_START
```

Example:

```text
Scenario: ROOM_A101_CLASS_START
- AC ON
- Light ON
```

```text
Scenario: ROOM_A101_CLASS_END
- AC OFF
- Light OFF
```

This makes the command simpler and reduces API calls.

---

## 6. Timeline Example

Example schedule:

```text
Class: 08:00 - 10:00
Room: A101
```

Recommended automation timeline:

```text
07:50   Turn ON AC and light
08:00   Class starts
10:00   Class ends
10:10   Turn OFF AC and light
```

Visual:

```text
07:50        08:00                10:00        10:10
 |------------|--------------------|------------|
 Turn ON      Class running         Class ends   Turn OFF
```

Reason:

```text
Turn ON before class starts.
Turn OFF after class ends.
Avoid making the room uncomfortable.
Avoid turning devices off too early.
```

---

## 7. Back-to-Back Class Example

Example:

```text
Class 1: 08:00 - 10:00
Class 2: 10:00 - 12:00
Room: A101
```

The system should not turn OFF at 10:10, because another class is already using the room.

Correct behavior:

```text
07:50   Turn ON
08:00   Class 1 starts
10:00   Class 1 ends
10:00   Class 2 starts
12:00   Class 2 ends
12:10   Turn OFF
```

Visual:

```text
07:50        08:00        10:00        12:00        12:10
 |------------|------------|------------|------------|
 Turn ON      Class 1      Class 2      End          Turn OFF
```

Simple rule:

```text
Only turn OFF when there is no active class and no upcoming class.
```

---

## 8. Manual Override

Manual override is needed because not everything can depend only on schedule.

Example cases:

```text
- Room is used for an unscheduled event
- Maintenance needs AC OFF
- Operator wants to force AC ON
- Room is closed
```

Manual override should be handled from the dashboard.

Example:

```text
Room A101
Manual override: AC OFF, Light OFF
Reason: Maintenance
Valid until: 14:00
```

Priority rule:

```text
Manual override has higher priority than schedule.
```

Visual:

```text
+-----------------------+
| Is manual override    |
| active?               |
+----------+------------+
           |
     +-----+-----+
     |           |
    Yes          No
     |           |
     v           v
Use override     Use class schedule
state            state
```

---

## 9. Dashboard Concept

The dashboard will show the current condition of each room.

Simple dashboard view:

```text
+------+-------------+--------------+--------------+----------------+
| Room | Class Now?  | Desired State| Actual State | Action         |
+------+-------------+--------------+--------------+----------------+
| A101 | Yes         | ON           | ON           | Normal         |
| A102 | Yes         | ON           | OFF          | Need action    |
| A103 | No          | OFF          | ON           | Need action    |
| A104 | Override    | OFF          | OFF          | Manual control |
+------+-------------+--------------+--------------+----------------+
```

The dashboard should show:

```text
- Room
- Current class
- Next class
- Desired AC/light state
- Actual AC/light state
- Last command
- Last status check
- Error or failed command
- Manual override status
```

The dashboard should also allow authorized users to:

```text
- Turn room ON manually
- Turn room OFF manually
- Create temporary override
- Cancel override
- See history/logs
```

---

## 10. Middleware Components

Simple component view:

```text
+-------------------+
| Schedule Reader   |
| Reads class data  |
+---------+---------+
          |
          v
+-------------------+
| State Evaluator   |
| Decides ON/OFF    |
+---------+---------+
          |
          v
+-------------------+
| Status Checker    |
| Checks real state |
+---------+---------+
          |
          v
+-------------------+
| Command Dispatcher|
| Sends API command |
+---------+---------+
          |
          v
+-------------------+
| Log & Dashboard   |
| Stores result     |
+-------------------+
```

---

## 11. Data Needed

To support both automation and dashboard, the system should store:

```text
1. Class schedule
2. Room list
3. Scenario mapping
4. Actual device state
5. Desired room state
6. Manual override
7. Command history
8. API response/error log
```

This data will make troubleshooting easier.

Example troubleshooting question:

```text
Why was AC in A101 turned off?
```

The system should be able to answer:

```text
Because no class was scheduled after 10:00,
the post-class buffer ended at 10:10,
there was no manual override,
so the middleware sent ROOM_A101_CLASS_END scenario.
```

---

## 12. Simplified MVP

For first version, we can build:

```text
1. Read schedule from database
2. Map each room to ON/OFF scenario
3. Calculate desired state
4. Poll actual device state every 5 minutes
5. Compare desired vs actual
6. Send scenario command if needed
7. Store command log
8. Add manual override table
9. Prepare data for dashboard
```

Dashboard can be added after the core middleware is stable.

---

## 13. Key Message for Discussion

The main concept is:

```text
The middleware does not just send commands.
The middleware decides what each room should look like,
compares it with the actual condition,
then sends the command only when needed.
```

Or in simpler words:

```text
Schedule tells us what should happen.
Status tells us what is happening.
Middleware decides what action is needed.
Dashboard shows everything clearly.
```

---

## 14. Final Architecture Summary

```text
+-------------------+       +----------------------+
| Class Schedule DB |       | Manual Override      |
+---------+---------+       +----------+-----------+
          |                            |
          +-------------+--------------+
                        |
                        v
              +------------------+
              | Middleware       |
              | Decision Engine  |
              +--------+---------+
                       |
        +--------------+--------------+
        |                             |
        v                             v
+---------------+             +----------------+
| Scenario API  |             | Dashboard      |
| AC / Light    |             | Monitor/Override|
+-------+-------+             +----------------+
        |
        v
+---------------+
| Classroom
```
