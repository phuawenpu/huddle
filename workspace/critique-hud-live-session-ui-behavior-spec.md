# Critique HUD — Live Session UI Behavior Specification

## 1. Purpose

The live-session interface should behave as a **real-time facilitation instrument**, not merely a transcript viewer or animated dashboard.

At any moment it should help the facilitator understand:

1. **Who is speaking and how the conversation is flowing**
2. **What the group is currently discussing**
3. **What changed in the structure or meaning of the discussion**
4. **What facilitation action may be most useful next**

The screen therefore combines three coordinated layers:

- **Audio / participation layer** — speakers, waveform, turn-taking, recent participation
- **Semantic layer** — issue, evidence, question, proposal, decision
- **Facilitation layer** — main tension, open loop, suggested intervention

The facilitator should be able to understand the state of the session without continuously reading the full transcript.

---

## 2. Core Live-Session Loop

The fundamental interaction loop should be:

```text
PERSON SPEAKS
      ↓
audio waveform reacts
      ↓
speaker attribution resolves
      ↓
transcript turn finalizes
      ↓
semantic meaning updates
      ↓
node / spoke / arrow reacts
      ↓
Now Lens identifies the consequence
      ↓
facilitator receives one possible next action
```

Different visual elements should feel like coordinated views of the **same conversational event**.

Example:

```text
Sam:
"In testing, 75% of users missed the settings page."

        ↓

orange waveform segment

        ↓

speaker-attributed transcript turn

        ↓

EVIDENCE node appears

        ↓

Evidence → Issue
SUPPORTS relationship appears

        ↓

Now Lens:
Evidence is strengthening the current issue

        ↓

Suggested prompt:
"Ask whether this occurred across user groups."
```

---

# 3. Speaker Identity System

Each participant should receive a persistent color for the session.

Example:

- **Alex — purple**
- **Jordan — green**
- **Sam — orange**

A participant's color should remain consistent across:

- avatar ring
- waveform history
- transcript marker
- semantic-node contributor badge
- selected-speaker state
- participation indicators
- speaker-focus mode

The facilitator should never need to relearn what a color means.

### Current-speaker behavior

When someone is speaking:

- their portrait ring may brighten slightly
- their name may gain subtle emphasis
- their live waveform color may become more vivid

Avoid excessive bouncing, flashing, or pulsing. The interface should feel like an instrument panel rather than an entertainment visualization.

---

# 4. Talk-Share Percentages

Talk-share percentages must have one explicit interpretation.

Recommended options:

- **share of total finalized speaking time during the full session**, or
- **share of finalized speaking time within a recent rolling window**

For live facilitation, a rolling recent window is generally more useful.

Example:

```text
LAST 5 MINUTES

Alex     38%
Jordan   32%
Sam      30%
```

This makes recent participation dynamics visible rather than allowing early-session behavior to dominate the current picture.

Full-session participation can remain available on tap or in a secondary view.

---

# 5. Multi-Colored Waveform — Meaning

The waveform should communicate:

- **horizontal position** = time
- **vertical amplitude** = captured audio energy / loudness
- **color** = speaker attribution for that portion of the conversation

Important distinction:

> The waveform represents the shared captured room audio.  
> The color represents speaker attribution over time.

The visualization should **not imply independently source-separated audio tracks** unless the system actually has that capability.

A single continuous room-audio waveform may be recolored according to finalized diarized speaker turns.

---

# 6. Live Waveform Behavior

The waveform should advance horizontally.

The **right edge represents now** and older conversation gradually moves left.

```text
30 sec ago                                NOW
│                                           │
─────────────────────────────────────────────►
A A A │ J J │ S │ A │ J J │ S S │ A
```

The recent-history rail should reveal at a glance:

- speaker transitions
- long monologues
- rapid exchanges
- silence
- interruptions
- turn-taking rhythm

A roughly 30-second recent-history rail works well for this purpose.

---

# 7. Speaker Attribution Resolution

Speaker attribution may resolve slightly after the acoustic event.

While the current speaker is unresolved, the newest waveform region can use a neutral or temporary treatment.

```text
PAST                               LIVE EDGE
│                                        │

Purple Purple Purple | Green | Orange | neutral
                                          ↑
                                 speaker unresolved
```

After diarization resolves the speaker:

```text
Purple Purple Purple | Green | Orange | Purple
                                          ↑
                                  resolved as Alex
```

This avoids pretending the system knows the speaker earlier than it actually does.

---

# 8. Waveform Amplitude

Waveform height should mean only:

> **captured audio energy / loudness**

It should not mean:

- confidence
- importance
- emotional intensity
- sentiment
- authority
- dominance

A louder waveform should simply indicate louder captured audio.

---

# 9. Speaker Transitions

Speaker changes should be visible mainly through color.

```text
Alex                     Jordan
purple                    green
██████████████▓▓▓▓│▓▓▓████████████
```

The waveform should still feel continuous because the meeting itself is continuous.

Possible subtle transition markers:

- color boundary
- small separator tick
- tiny speaker initial
- slight change in emphasis

Avoid large visual gaps unless there was actual silence.

---

# 10. Overlapping Speech

Overlapping speech requires a distinct treatment.

Do not blend two speaker colors into an arbitrary third color.

Possible representations:

```text
──────── Alex purple waveform ────────
             ║
             ║ overlap
             ║
        Jordan green underline
```

or:

```text
██████████████
purple waveform
   green lower highlight
```

The intended meaning is simply:

> more than one participant appears active in this interval.

Do not imply perfect source separation.

---

# 11. Silence

Silence should remain visible.

```text
Alex        silence          Jordan
███████────.................────██████
```

Silence may itself be useful facilitation information—for example, a pause after a difficult question or a proposal that receives no immediate response.

Do not fill silence simply to make the waveform look active.

---

# 12. Speaker Focus

The interface may support:

> **Tap a speaker to focus**

Tapping Alex could temporarily:

- keep Alex's waveform regions fully saturated
- fade other speakers
- brighten semantic nodes Alex contributed to
- emphasize Alex's transcript turns

```text
FOCUS: ALEX

Waveform:
Alex remains full color
others fade

Semantic map:
nodes involving Alex brighten

Transcript:
Alex's recent turns are emphasized
```

This interaction should answer:

> "What has this participant contributed?"

It must not imply that the participant agrees with every node they contributed to.

---

# 13. Current Focus at the Center

The center represents:

> **the current conversational focus**

It should not merely repeat the meeting title.

Example:

```text
CURRENT FOCUS

Navigation critique

How might we make navigation clearer
for first-time users?
```

Over a long session, the focus may transition:

```text
Navigation critique
        ↓
Onboarding hierarchy
        ↓
Settings discoverability
        ↓
Prototype decision
```

These transitions should be relatively infrequent so the center remains spatially stable.

---

# 14. Core Semantic Node Types

## Issue

A problem, tension, contradiction, or unresolved concern.

Example:

> Unclear hierarchy

## Evidence

A concrete observation, test result, example, or source that supports or challenges another idea.

Example:

> 75% of users missed settings

## Question

Something genuinely unresolved.

Example:

> How do users find key tasks?

## Proposal

A possible response or course of action.

Example:

> Simplify navigation to three primary items

## Decision

Something the group appears ready to commit to, test, or act on.

Example:

> Test simplified navigation in the next round

---

# 15. Fixed Semantic Positions

The categories should remain in approximately consistent positions.

```text
                    ISSUE
                     ●

     EVIDENCE ●              ● QUESTION


          PROPOSAL ●     ● DECISION
```

This creates a learnable visual grammar.

Eventually the facilitator should be able to glance at the structure and think:

> "We have strong evidence and questions, but no proposal yet."

The visualization therefore acts as a **live semantic compass**.

---

# 16. Meaning of the Spokes

A spoke connects the current focus to an outer semantic node.

It should have one clear meaning:

> **How strongly this semantic object is currently related to the active focus.**

A spoke should **not** represent:

- chronology
- causation
- agreement
- speaker identity

Those meanings belong elsewhere.

---

# 17. Spoke Behavior

### New relevant concept
The spoke fades in.

### Concept reinforced
The spoke becomes slightly brighter or thicker.

### Concept becomes central
The spoke becomes more visually prominent.

### Discussion moves away
The spoke gradually fades.

### Concept becomes historical
The spoke becomes faint or disappears from the active live view.

```text
weak relevance
────────

strong relevance
━━━━━━━━
```

Changes should remain subtle and should never cause the whole wheel to feel unstable.

---

# 18. Meaning of the Arrows

Arrows between outer nodes represent:

> **semantic relationships between ideas**

Possible relationship types include:

- supports
- challenges
- leads to
- depends on
- proposes
- tests
- addresses
- results in

Example:

```text
Evidence
   │
   │ supports
   ▼
Issue
```

or:

```text
Proposal
   │
   │ leads to
   ▼
Decision
```

Arrows show the reasoning structure of the conversation. They are not decorative connectors.

---

# 19. Arrow Visibility

The mobile interface should not become a dense knowledge graph.

Recommended behavior:

- show roughly **3–5 active relationships**
- emphasize the newest or strongest links
- reveal weaker links when a node is tapped
- suppress redundant relationships

The goal is:

> readable reasoning, not graph density

---

# 20. Arrow Creation

A relationship can emerge across turns.

Example:

> "75% of people couldn't find settings."

The UI creates an **Evidence** node.

Later:

> "That's probably because the hierarchy isn't obvious."

The UI establishes:

```text
Evidence
75% missed settings

       supports
           ↓

Issue
Unclear hierarchy
```

The arrow should **trace into view once and then settle**.

It should not remain continuously animated.

---

# 21. Node Creation — Bloom

When a genuinely new semantic object enters the discussion:

1. its semantic position activates
2. the node softly expands into view
3. the label appears
4. contributor badges appear
5. the node settles

```text
○ → ◉ → ●
```

Meaning:

> a new meaningful object has entered the discussion

---

# 22. Node Reinforcement — Pulse

When new dialogue reinforces an existing node, do not create a duplicate.

Instead:

- pulse the existing node once
- slightly increase prominence
- update contributor badges if needed

Meaning:

> this idea has just been strengthened

Repeated references to the same idea should strengthen the existing object rather than produce several near-duplicate nodes.

---

# 23. Node States

Nodes should communicate semantic maturity.

### Emerging
Faint outline.

### Active
Normal bright treatment.

### Tentative
Dashed or incomplete boundary.

### Grounded
Strong solid border or source marker.

### Resolved
Settled visual treatment, optionally with a checkmark.

### Historical
Dimmed treatment.

These states communicate more useful meaning than raw AI confidence percentages.

---

# 24. Grounding and Source Evidence

Important semantic findings should connect visibly to their source.

A node can use a small marker such as:

```text
✓ grounded
```

or a source-link icon.

Tapping a node should be able to reveal:

- exact supporting quote
- speaker
- timestamp
- transcript turn
- source relationship

The user should experience:

> "The AI says this is important, and here is what it is based on."

rather than simply:

> "The AI says this is important."

---

# 25. Participant Badges on Nodes

Small badges such as:

```text
[A] [J] [S]
```

should mean:

> **these participants contributed substantive speech connected to this object**

They should **not** mean:

> these participants agree with this object

A participant may have introduced, challenged, questioned, supported, or reframed the topic.

Agreement or disagreement should be represented separately if needed.

---

# 26. Participant Badge Ordering

A useful ordering is:

1. originator
2. subsequent contributors
3. newest contributor optionally highlighted briefly

```text
[A] [J] [S]
 ↑
originator
```

Badge size should not imply human importance.

---

# 27. Four Core Semantic Actions

Each new finalized dialogue event can cause one or more of four core UI actions:

1. **Add** a semantic node
2. **Strengthen** an existing node
3. **Link** two nodes
4. **Promote** a node into a more mature or actionable state

This is the core behavioral grammar of the semantic visualization.

---

# 28. Animation Vocabulary

The interface should use a very small number of meaningful animations.

## Bloom
**Meaning:** a new idea appeared.

Use for new semantic nodes.

## Pulse
**Meaning:** an existing idea was reinforced.

Use once when meaningful new support arrives.

## Trace
**Meaning:** a new relationship was recognized.

Use when an arrow is created.

## Settle
**Meaning:** an idea became more stable, grounded, resolved, or actionable.

Use when semantic maturity changes.

## Fade
**Meaning:** an idea is leaving immediate conversational focus.

Use to reduce prominence without deleting history.

Every animation should communicate a state change.

---

# 29. No Wheel Rotation

The semantic visualization should **not rotate continuously**.

Avoid:

- spinning
- orbiting nodes
- constant drifting
- decorative particle movement
- repeated ambient pulsing

The facilitator needs:

- spatial stability
- fast recognition
- low cognitive load
- learnable semantic positions

Movement should occur only when the dialogue creates meaningful change.

The interface should feel like a **stable instrument whose readings change**, not a continuously animated object.

---

# 30. Recency

The interface should make this question very easy to answer:

> **What just changed?**

Useful signals:

- newest waveform segment at the live edge
- newest semantic node briefly blooms
- reinforced node pulses once
- newest relationship traces in
- related Now Lens field briefly highlights
- corresponding transcript turn is subtly emphasized

Then everything should settle.

Do not leave several parts flashing simultaneously.

---

# 31. Cross-Highlighting

The waveform, transcript, speaker system, and semantic map should behave as different views of the same underlying timeline.

Tapping a semantic node should be able to:

- keep the node bright
- emphasize contributing speakers
- highlight relevant waveform intervals
- reveal supporting transcript turns

```text
SEMANTIC OBJECT
      ↕
TRANSCRIPT
      ↕
SPEAKER
      ↕
TIME IN AUDIO
```

Likewise:

- tap a transcript turn → highlight its waveform interval and semantic object
- tap a waveform segment → reveal its transcript turn
- tap a speaker → emphasize their contributions throughout the UI

This creates provenance and trust.

---

# 32. Now Lens

The **Now Lens** is the compressed facilitation layer.

Its purpose is:

> **Show the facilitator the most important interpretation of the live state right now.**

Recommended fields:

### Main Tension
What unresolved friction or contradiction is most important?

### Open Loop
What question, dependency, or commitment remains unresolved?

### Prompt
What single facilitation move could help next?

Example:

```text
MAIN TENSION
Unclear hierarchy

OPEN LOOP
Does this affect onboarding?

PROMPT
Ask for a concrete user example
```

The Now Lens should update less frequently than the transcript.

It should feel considered rather than twitchy.

---

# 33. One Prompt at a Time

Show only one primary facilitation suggestion at once.

Avoid simultaneously showing:

- Ask for evidence
- Invite quieter voices
- Clarify the issue
- Check agreement
- Ask for examples
- Establish next steps

Instead:

```text
PROMPT

Ask for evidence
```

The experience should remain calm and actionable.

---

# 34. Prompt Logic

Prompts should emerge from the semantic structure of the discussion.

### Issue but weak evidence
→ **Ask for evidence**

### Strong evidence but unclear issue
→ **Clarify what the evidence implies**

### Proposal but unresolved question
→ **Resolve the open question first**

### Proposal with supporting evidence
→ **Test for agreement**

### Apparent agreement without a next step
→ **Confirm owner and next action**

### Recent participation imbalance
→ **Invite another perspective**

The UI should help the facilitator intervene at the right moment, not simply summarize the meeting.

---

# 35. Transcript Behavior

The transcript should remain compact and readable.

A turn may show:

- speaker identity
- timestamp
- utterance
- optional semantic marker

```text
S   9:41

"In testing, 75% missed the settings page."

Evidence
```

Avoid attaching too many permanent badges or metrics.

The transcript remains the exact chronological source layer.

---

# 36. Transcript–Waveform Synchronization

Transcript turns and waveform regions should share the same time model.

When a transcript turn is tapped:

- its waveform interval highlights
- related semantic node may highlight

When a waveform segment is tapped:

- associated transcript turn becomes visible
- related semantic object may highlight

This creates intuitive temporal-semantic navigation.

---

# 37. Auto-Follow

During normal live use:

> the transcript follows the newest finalized turn

If the facilitator scrolls upward:

- auto-follow pauses
- new turns continue accumulating
- a small badge indicates unseen turns
- **Jump to latest** restores live-follow mode
- no history is discarded

The facilitator must be able to inspect older context without losing the ongoing session.

---

# 38. Private Mode

The **Private** state is a human-control boundary.

Meaning:

> AI-generated interpretations remain visible only to the facilitator.

Private content may include:

- inferred tension
- tentative semantic relationships
- suggested prompts
- unapproved summaries
- semantic interpretations awaiting review

Nothing should automatically become participant-facing simply because the AI generated it.

---

# 39. Publish

**Publish** should mean:

> deliberately move a reviewed item from facilitator-private interpretation into shared meeting state

It should not mean:

> mirror the entire facilitator screen

Example:

```text
PRIVATE

Issue:
Navigation hierarchy unclear

       ↓ facilitator reviews

PUBLISH

SHARED

Navigation hierarchy needs testing.
```

Publishing should feel deliberate.

Where possible, source grounding should be revalidated before publication.

---

# 40. Capture

**Capture** should mean:

> intentionally capture visual context associated with the current moment

It should not imply continuous camera surveillance.

The interaction should preserve these principles:

- camera use is explicit
- capture is deliberate
- context is linked to a particular meeting moment
- visual evidence is context, not automatic proof about a person

---

# 41. Recommended Information Hierarchy

## Layer 1 — Instant Read

Immediately visible:

- current focus
- current speaker / conversation flow
- main tension
- open loop
- one suggested action

## Layer 2 — Semantic Structure

Inspectable:

- issues
- evidence
- questions
- proposals
- decisions
- strongest semantic relationships

## Layer 3 — Proof

Available on tap:

- exact transcript quote
- speaker
- timestamp
- source turn
- corresponding waveform location
- grounding status

This hierarchy prevents the primary screen from becoming overloaded.

---

# 42. Recommended Mobile Limits

For the phone UI:

- show no more than roughly **five active semantic nodes**
- show only the **strongest 3–5 relationships**
- emphasize only **one newest semantic change**
- show only **one primary facilitation prompt**
- keep older semantic material available through history or drill-down

The live interface should compress complexity rather than expose the entire graph.

---

# 43. Meaning of Major Visual Elements

| Visual element | Intended meaning |
|---|---|
| Speaker color | Persistent participant identity |
| Waveform height | Captured audio energy |
| Waveform color | Speaker attribution over that time interval |
| Waveform horizontal position | Time |
| Portrait glow | Current or very recent speaker |
| Talk percentage | Share of speaking time in a defined window |
| Center circle | Current conversational focus |
| Outer semantic node | Meaningful active discussion object |
| Node brightness | Current salience |
| Node boundary | Emerging, tentative, grounded, resolved, or historical state |
| Center spoke | Relevance to current focus |
| Outer arrow | Semantic relationship between ideas |
| Arrow label | Relationship type |
| Speaker badges on node | Participants who contributed to that semantic object |
| Node bloom | New semantic object |
| Node pulse | Existing object reinforced |
| Arrow trace | New relationship recognized |
| Node settle | Object became more stable or actionable |
| Fade | Object is leaving immediate conversational focus |
| Now Lens — tension | Main unresolved friction |
| Now Lens — open loop | Important unresolved question or dependency |
| Now Lens — prompt | Best current facilitation intervention |
| Transcript | Exact chronological source |
| Private | Facilitator-only AI interpretation |
| Publish | Human-approved transition to shared state |
| Capture | Deliberate visual/context capture |

---

# 44. Core Product Action

The most important action of the product should be:

> **Turn live dialogue into one clear next facilitation move.**

The semantic visualization is not the product by itself.

Its purpose is:

```text
EVENT
   ↓
SEMANTIC UPDATE
   ↓
VISUAL CUE
   ↓
FACILITATOR ACTION
```

Examples:

```text
new evidence spoken
      ↓
Evidence node blooms
      ↓
spoke strengthens
      ↓
Evidence → Issue relationship appears
      ↓
Prompt:
"Ask whether this generalizes."
```

```text
repeated uncertainty
      ↓
Question node pulses
      ↓
Issue → Question relationship strengthens
      ↓
Prompt:
"Clarify the open loop."
```

```text
proposal becomes actionable
      ↓
Proposal → Decision relationship traces in
      ↓
Decision node settles
      ↓
Prompt:
"Confirm owner and next step."
```

---

# 45. Final Design Principle

The strongest version of the interface should not feel like:

> **"AI is monitoring the meeting."**

It should feel like:

> **"The structure of the discussion is gradually becoming visible."**

Every major visual behavior should answer one of three questions.

### Who just contributed?

Answered by:

- speaker strip
- waveform
- transcript identity

### What changed in the meaning of the discussion?

Answered by:

- nodes
- spokes
- arrows
- semantic state changes

### What deserves the facilitator's attention now?

Answered by:

- Now Lens
- open loop
- one suggested facilitation prompt

The interface should remain calm, spatially stable, source-grounded, and event-driven.

Its primary value is not animation or transcription.

Its value is helping a facilitator **see the evolving reasoning of a live group and act at the right moment**.
