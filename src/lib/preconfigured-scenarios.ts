import type { PrismaClient } from "@prisma/client";
import { estimateBudget } from "./budget";
import { normalizeScenarioTurns } from "./scenario-transcript";
import type {
  CrossTalkLevel,
  Difficulty,
  DiscussionCategory,
  ParticipationProfile,
  ScenarioSpeaker,
  ScenarioTurn,
} from "./types";
import { createDefaultCasting } from "./voice-casting";

export const PRECONFIGURED_SCENARIO_LIMIT = 10;
export const PRECONFIGURED_SCENARIO_PREFIX = "preset-v1-";
export const PRECONFIGURED_CATALOG_REVISION = 2;

type OverlapKind = "interruption" | "eager_agreement" | "backchannel";
type BlueprintCategory = DiscussionCategory | "constraints" | "alternatives";

interface SpeakerBlueprint extends Partial<ScenarioSpeaker> {
  name: string;
  role: string;
  viewpoint: string;
  discourseStyle: string;
  habitualMove: string;
  calibration: string;
}

interface DialogueTurnBlueprint {
  speakerIndex: number;
  category: BlueprintCategory;
  text: string;
  signal: string;
  respondsTo?: number;
  overlap?: OverlapKind;
  pauseBeforeMs?: number;
}

interface ScenarioBlueprint {
  slug: string;
  title: string;
  description: string;
  durationMinutes: 3 | 4 | 5;
  topic: string;
  domain: string;
  workshopType: string;
  objective: string;
  phase: string;
  criteria: string[];
  difficulty: Difficulty;
  crossTalkLevel: CrossTalkLevel;
  participationProfile: ParticipationProfile;
  speakers: SpeakerBlueprint[];
  dialogue: DialogueTurnBlueprint[];
  expectedWindowOutcome: {
    tensions: string[];
    emergingDecision: string;
    ownedAction: string;
    unresolvedConcern: string;
  };
}

export interface PreconfiguredScenario {
  id: string;
  title: string;
  description: string;
  topic: string;
  domain: string;
  workshopType: string;
  objective: string;
  phase: string;
  criteria: string[];
  language: string;
  durationMinutes: number;
  speakerCount: number;
  difficulty: Difficulty;
  crossTalkLevel: CrossTalkLevel;
  participationProfile: ParticipationProfile;
  budget: ReturnType<typeof estimateBudget>;
  speakers: ScenarioSpeaker[];
  turns: ScenarioTurn[];
  expectedWindowOutcome: ScenarioBlueprint["expectedWindowOutcome"];
  status: "draft";
}

const BLUEPRINTS: ScenarioBlueprint[] = [
  {
    slug: "accessible-transit-kiosk",
    title: "Transit Kiosk: Recovering from Ticketing Errors",
    durationMinutes: 3,
    description:
      "A prototype review where accessibility evidence, queue pressure, privacy, and technical constraints pull the team toward different recovery designs.",
    topic: "Accessible error recovery for a public-transit ticket kiosk",
    domain: "Public transport and inclusive interaction design",
    workshopType: "prototype_review",
    objective:
      "Choose a testable recovery flow that works for low-vision riders, tourists, and people under time pressure without exposing payment details.",
    phase: "evaluate",
    criteria: [
      "Accessible without relying on colour, vision, or precise touch",
      "Recovers quickly during peak queues",
      "Protects payment and personal information",
      "Can be tested on the current kiosk hardware",
    ],
    difficulty: "challenging",
    crossTalkLevel: "occasional",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Maya",
        role: "accessibility researcher",
        viewpoint: "observed low-vision and motor-access needs",
        discourseStyle: "specific and questioning",
        habitualMove: "separates an assumption from observed behaviour",
        calibration:
          "I’m Maya, the accessibility researcher. I’ll keep us anchored in observed rider behaviour and flag interactions that depend on vision or precise touch.",
      },
      {
        name: "Jon",
        role: "interaction designer",
        viewpoint: "a legible end-to-end recovery journey",
        discourseStyle: "visual but self-correcting",
        habitualMove: "offers a concrete interface alternative",
        calibration:
          "I’m Jon, the interaction designer. I’ll listen for where the recovery flow loses context and suggest interface changes we can prototype today.",
      },
      {
        name: "Priya",
        role: "station operations lead",
        viewpoint: "queue flow and staff workload at busy stations",
        discourseStyle: "direct and practical",
        habitualMove: "tests ideas against peak-hour operations",
        calibration:
          "I’m Priya from station operations. I’ll test each idea against peak queues, staff workload, vandal-resistant hardware, and what happens when assistance is unavailable.",
      },
      {
        name: "Leon",
        role: "payments engineer",
        viewpoint: "secure recovery on constrained kiosk hardware",
        discourseStyle: "measured and technical",
        habitualMove: "names a constraint and proposes a bounded experiment",
        calibration:
          "I’m Leon, the payments engineer. I’ll watch for privacy and hardware constraints, then translate unresolved questions into something we can instrument safely.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 1,
        category: "positions",
        text: "The prototype keeps the failed card visible and adds a red retry button. My instinct was that preserving context would calm people down.",
        signal:
          "The current design preserves context with a colour-coded retry action.",
      },
      {
        speakerIndex: 0,
        category: "evidence",
        text: "In the walkthrough, two low-vision riders never found that button. One kept tapping the card image because it looked like the active control.",
        signal:
          "Low-vision riders mistook the card image for the recovery control.",
      },
      {
        speakerIndex: 2,
        category: "constraints",
        text: "And while they search, the queue stops. At Central, staff step in after about one failed attempt, but the smaller stations have nobody nearby.",
        signal:
          "Recovery must work without staff and avoid blocking the queue.",
        overlap: "interruption",
      },
      {
        speakerIndex: 1,
        category: "questions",
        text: "So is the problem discoverability, or are we asking a stressed rider to diagnose the payment failure before they can move on?",
        signal:
          "The group distinguishes control discoverability from diagnostic burden.",
      },
      {
        speakerIndex: 3,
        category: "constraints",
        text: "Both, but we cannot read the failure reason aloud by default. A declined card plus a spoken balance message would expose private information.",
        signal: "Spoken diagnostics can reveal private payment information.",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "What if the first response is neutral: a physical-key prompt, a tone, and two choices—try another method or cancel—without naming the reason?",
        signal:
          "A neutral multimodal recovery prompt avoids disclosing the failure reason.",
      },
      {
        speakerIndex: 2,
        category: "positions",
        text: "That helps access, but cancel cannot return people to the welcome screen immediately. Tourists then lose the fare and language choices they already made.",
        signal:
          "Cancellation should preserve earlier fare and language selections.",
      },
      {
        speakerIndex: 1,
        category: "alternatives",
        text: "Right—cancel the payment attempt, not the whole journey. We can keep the fare summary, mask the card, and put both actions beside the keypad.",
        signal: "The design changes from full reset to payment-only recovery.",
        overlap: "eager_agreement",
      },
      {
        speakerIndex: 3,
        category: "evidence",
        text: "The keypad can support that, and masking is already implemented. The unknown is whether the older audio board can play distinct prompts without delaying authorization.",
        signal:
          "Existing hardware supports keypad actions and masking, but audio latency is unknown.",
      },
      {
        speakerIndex: 0,
        category: "themes",
        text: "We’re converging on continuity without disclosure: preserve the trip, hide payment detail, and make the next action available through touch, sound, and physical keys.",
        signal:
          "Continuity, privacy, and multimodal access form the central design principle.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Can we also measure abandonment? A flow that is accessible in the lab but adds twenty seconds will still fail during the morning peak.",
        signal:
          "Peak-hour completion time and abandonment remain material success measures.",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll build the masked payment-state branch and log time-to-choice, retries, and cancellation. I can test the audio-board delay before tomorrow’s prototype session.",
        signal:
          "The engineer owns a measurable prototype and hardware-latency test.",
      },
      {
        speakerIndex: 1,
        category: "decisions",
        text: "Then our next version uses payment-only recovery with three equivalent cues. We won’t expose a decline reason unless the rider explicitly requests private audio.",
        signal:
          "The team chooses payment-only multimodal recovery with opt-in private detail.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "I’m comfortable testing that, but private audio still assumes headphones or a handset. Let’s leave that channel unresolved rather than pretending the kiosk solves it.",
        signal:
          "Private audio delivery remains an unresolved accessibility and privacy concern.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "preserving journey context versus queue speed",
        "spoken accessibility cues versus payment privacy",
      ],
      emergingDecision: "Test payment-only recovery with multimodal controls.",
      ownedAction: "Leon will prototype and instrument the recovery branch.",
      unresolvedConcern:
        "A genuinely private audio channel is not yet available.",
    },
  },
  {
    slug: "rural-telehealth-handoff",
    title: "Telehealth: Rural Appointment Handoff",
    durationMinutes: 4,
    description:
      "A service-design critique of booking, connectivity failure, clinical escalation, and the work transferred to patients and rural clinic staff.",
    topic:
      "A resilient telehealth appointment journey for intermittent connectivity",
    domain: "Healthcare service design",
    workshopType: "service_design_critique",
    objective:
      "Define a safe fallback journey that preserves patient agency and clinical context when video or mobile data fails.",
    phase: "define",
    criteria: [
      "Maintains clinical safety during connection failure",
      "Does not shift hidden coordination work onto patients",
      "Works with low bandwidth and shared devices",
      "Makes consent and escalation choices explicit",
    ],
    difficulty: "challenging",
    crossTalkLevel: "occasional",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Aroha",
        role: "service designer",
        viewpoint: "continuity across digital and human touchpoints",
        discourseStyle: "synthesizing",
        habitualMove: "maps where responsibility changes hands",
        calibration:
          "I’m Aroha, the service designer. I’ll track responsibility across booking, consultation, and follow-up, especially where a connection failure silently transfers work.",
      },
      {
        name: "Samir",
        role: "rural general practitioner",
        viewpoint: "clinical safety and usable patient context",
        discourseStyle: "calm and diagnostic",
        habitualMove:
          "asks what information is available at the decision point",
        calibration:
          "I’m Samir, a rural GP. I’ll focus on clinical risk, what context survives a failed call, and when a remote appointment must escalate.",
      },
      {
        name: "Mei",
        role: "patient advocate",
        viewpoint: "consent, dignity, cost, and shared-device realities",
        discourseStyle: "plain-spoken and probing",
        habitualMove: "surfaces burdens hidden from the service team",
        calibration:
          "I’m Mei, the patient advocate. I’ll listen for hidden data costs, shared-phone privacy, consent gaps, and instructions that assume patients can coordinate providers.",
      },
      {
        name: "Tane",
        role: "clinic coordinator",
        viewpoint: "front-desk capacity and local fallback operations",
        discourseStyle: "practical and concise",
        habitualMove:
          "tests whether staff can actually deliver the proposed service",
        calibration:
          "I’m Tane, the clinic coordinator. I’ll test the journey against reception capacity, missed-call handling, local transport, and the tools staff already use.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 0,
        category: "positions",
        text: "The journey map currently treats video failure as a technical exception: after thirty seconds, the clinician calls the patient’s mobile and continues by voice.",
        signal:
          "The current fallback assumes a direct clinician callback is sufficient.",
      },
      {
        speakerIndex: 2,
        category: "evidence",
        text: "That assumes the mobile is private and has credit. In our interviews, several people borrowed a relative’s phone or used the library connection.",
        signal:
          "Shared devices and data costs make direct callbacks unsafe or inaccessible.",
      },
      {
        speakerIndex: 1,
        category: "constraints",
        text: "Voice also changes what I can assess. For a wound review, losing video is not a degraded version of the same consultation; it changes the clinical decision.",
        signal:
          "Connection loss can change clinical modality and safety, not merely call quality.",
        overlap: "interruption",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "Then should the fallback depend on appointment purpose, rather than applying one recovery rule to every failed session?",
        signal: "Fallback rules may need to be purpose-specific.",
      },
      {
        speakerIndex: 3,
        category: "constraints",
        text: "Yes, but reception cannot interpret clinical purpose from a free-text booking note while six other calls are waiting. We need a visible category and instruction.",
        signal:
          "Clinic staff need structured categories rather than interpreting free text.",
      },
      {
        speakerIndex: 1,
        category: "alternatives",
        text: "We could classify at booking: safe for voice, needs images, or needs live observation. That is not a diagnosis; it is a fallback requirement.",
        signal:
          "Booking can capture a bounded fallback requirement without diagnosing.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Who explains those labels? If patients see ‘needs images’ without context, they may upload sensitive photos from a shared device because the form appears mandatory.",
        signal:
          "Fallback labels and uploads require clear consent and privacy guidance.",
        overlap: "interruption",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "Let’s separate preparation from consent. The booking records the clinician’s fallback need; the patient chooses a private channel later, with phone and local-clinic options alongside upload.",
        signal:
          "The service separates clinical preparation from the patient’s channel consent.",
      },
      {
        speakerIndex: 3,
        category: "evidence",
        text: "A local-clinic option is workable on Tuesdays and Thursdays. Other days, the nearest staffed room may be an hour away, so the interface must show availability.",
        signal: "Local assisted access varies by day and location.",
      },
      {
        speakerIndex: 1,
        category: "themes",
        text: "The pattern is that technical recovery and clinical recovery are different. We need to preserve context, then choose a medically acceptable channel with the patient.",
        signal:
          "Technical reconnection must be distinguished from clinically safe recovery.",
      },
      {
        speakerIndex: 2,
        category: "positions",
        text: "I support that, provided ‘with the patient’ is real. The default cannot quietly become travel to a clinic because it is easier for our system.",
        signal:
          "Operational convenience must not override patient agency or travel burden.",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll map actual room availability and callback capacity by clinic. That gives us honest choices instead of designing around a service that exists only on paper.",
        signal: "The coordinator owns validation of real fallback capacity.",
      },
      {
        speakerIndex: 0,
        category: "decisions",
        text: "We’ll prototype a purpose-aware fallback card with three patient-selected channels, explicit availability, and a retained consultation summary for whichever professional picks it up.",
        signal:
          "The team chooses a purpose-aware, patient-selected, context-preserving fallback.",
      },
      {
        speakerIndex: 1,
        category: "questions",
        text: "We still have no answer for urgent symptoms disclosed after the connection drops. The next test must include that escalation, not only routine appointment recovery.",
        signal: "Post-disconnection urgent escalation remains unresolved.",
      },
      {
        speakerIndex: 2,
        category: "evidence",
        text: "Patients told us urgency is hardest to judge when they are already frightened. A red emergency label alone may make them abandon the handoff entirely.",
        signal:
          "Escalation language must support frightened patients without causing abandonment.",
      },
      {
        speakerIndex: 1,
        category: "alternatives",
        text: "Then ask about change, not diagnosis: are symptoms suddenly worse, is breathing harder, or can they safely wait for a callback?",
        signal:
          "Change-based questions offer a safer escalation path than patient self-diagnosis.",
      },
      {
        speakerIndex: 3,
        category: "constraints",
        text: "Those answers must enter the clinic queue visibly. If they arrive as another note, staff may discover urgency only when opening the record later.",
        signal:
          "Urgent fallback answers require visible queue placement rather than passive notes.",
      },
      {
        speakerIndex: 0,
        category: "actions",
        text: "I’ll add a dropped-call escalation branch and test whether patients understand it, complete it, and receive a credible response time.",
        signal: "The service designer owns a measurable escalation-path test.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "technical reconnection versus clinically safe recovery",
        "operational convenience versus patient agency",
      ],
      emergingDecision:
        "Prototype purpose-aware, patient-selected fallback channels.",
      ownedAction: "Tane will validate real clinic-room and callback capacity.",
      unresolvedConcern:
        "Urgent symptoms disclosed after connection loss need escalation rules.",
    },
  },
  {
    slug: "school-heatwave-priorities",
    title: "School Heatwave: Cooling Priorities",
    durationMinutes: 5,
    description:
      "A participatory prioritization meeting balancing immediate relief, long-term adaptation, disability access, maintenance, and a fixed capital budget.",
    topic: "Prioritizing heat-resilience measures for an ageing public school",
    domain: "Climate adaptation and education",
    workshopType: "prioritization",
    objective:
      "Select a phased cooling strategy that reduces learning disruption this summer while building toward equitable long-term resilience.",
    phase: "decide",
    criteria: [
      "Reduces dangerous heat exposure quickly",
      "Benefits students with different sensory and mobility needs",
      "Fits maintenance and electrical capacity",
      "Avoids locking the school into a poor long-term system",
    ],
    difficulty: "challenging",
    crossTalkLevel: "frequent",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Nadia",
        role: "student representative",
        viewpoint: "daily classroom experience and unequal exposure",
        discourseStyle: "concrete and candid",
        habitualMove: "returns abstract options to a specific school day",
        calibration:
          "I’m Nadia, the student representative. I’ll keep this grounded in actual classrooms, unequal heat exposure, and what students can realistically use during lessons.",
      },
      {
        name: "Owen",
        role: "facilities manager",
        viewpoint:
          "electrical limits, maintenance, and installation sequencing",
        discourseStyle: "pragmatic and detailed",
        habitualMove: "identifies dependencies hidden inside a simple option",
        calibration:
          "I’m Owen from facilities. I’ll flag electrical, maintenance, installation, and procurement dependencies so the preferred option can survive contact with the building.",
      },
      {
        name: "Farah",
        role: "inclusive education lead",
        viewpoint: "sensory, respiratory, and mobility access",
        discourseStyle: "measured and insistent",
        habitualMove: "asks who is excluded by the apparent compromise",
        calibration:
          "I’m Farah, the inclusive education lead. I’ll examine sensory, respiratory, and mobility impacts, especially where an average comfort measure hides unequal harm.",
      },
      {
        name: "Diego",
        role: "climate design consultant",
        viewpoint: "passive cooling and long-term resilience",
        discourseStyle: "systems-oriented",
        habitualMove: "connects short-term choices to future performance",
        calibration:
          "I’m Diego, the climate design consultant. I’ll connect immediate relief to passive cooling, energy demand, and whether each investment supports the longer plan.",
      },
      {
        name: "Ruth",
        role: "school principal",
        viewpoint: "learning continuity, budget, and community accountability",
        discourseStyle: "facilitative but decisive",
        habitualMove: "names the trade-off and asks for an accountable choice",
        calibration:
          "I’m Ruth, the principal. I’ll keep learning continuity, budget, and public accountability visible, and I’ll press us to leave with owners and sequencing.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 4,
        category: "positions",
        text: "We can fund portable air conditioners for twelve rooms now, or spend the same amount on shade, ventilation controls, and electrical design for a later system.",
        signal:
          "The budget forces a choice between immediate equipment and enabling long-term work.",
      },
      {
        speakerIndex: 0,
        category: "evidence",
        text: "Twelve rooms sounds fair until you see the timetable. Science labs and the top-floor language rooms stay occupied longest, and some classes move every period.",
        signal:
          "Room-based allocation does not match student exposure across the timetable.",
      },
      {
        speakerIndex: 1,
        category: "constraints",
        text: "Also, six of those rooms share one circuit. Portable units there will trip protection unless we rewire, which consumes most of the holiday window.",
        signal: "Electrical capacity prevents the simple portable-unit plan.",
        overlap: "interruption",
      },
      {
        speakerIndex: 3,
        category: "alternatives",
        text: "External shade on the western block cuts afternoon gain without that load. It will not solve still air, but it buys relief while preserving the electrical upgrade.",
        signal:
          "External shade offers immediate passive relief without consuming electrical capacity.",
      },
      {
        speakerIndex: 2,
        category: "constraints",
        text: "Please do not assume more airflow is universally better. Two students have sound sensitivity, and one cannot sit near a high-velocity fan for respiratory reasons.",
        signal:
          "High-velocity airflow introduces sensory and respiratory exclusions.",
      },
      {
        speakerIndex: 0,
        category: "positions",
        text: "Exactly. Last summer the answer was ‘move near the fan,’ which meant the same students choosing between concentration and physical comfort every lesson.",
        signal:
          "Past cooling practice transferred the trade-off to individual students.",
        overlap: "eager_agreement",
      },
      {
        speakerIndex: 4,
        category: "questions",
        text: "Can we prioritize zones and personal choice together—shade the hottest block, create two cooled refuge rooms, and provide low-noise air movement elsewhere?",
        signal:
          "A layered strategy may combine zone treatment, refuge, and varied local controls.",
      },
      {
        speakerIndex: 1,
        category: "evidence",
        text: "Two refuge rooms fit the existing circuits if they are on the ground floor. I can add temperature logging, but moving entire classes there needs a timetable protocol.",
        signal:
          "Two ground-floor refuge rooms are technically feasible but operationally constrained.",
      },
      {
        speakerIndex: 3,
        category: "themes",
        text: "That is a useful shift: not one device everywhere, but a hierarchy—reduce heat gain, offer controllable local relief, then reserve active cooling for peaks.",
        signal:
          "The strategy evolves into passive, controllable, then active layers.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Who controls access to the refuge rooms? If students need permission each time, the design will reproduce the same stigma as leaving class for support.",
        signal: "Refuge-room access rules could stigmatize disabled students.",
        overlap: "interruption",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "Could the rooms be bookable as normal teaching spaces during heat alerts, with classes rotating, rather than labelled as special-needs rooms?",
        signal:
          "Timetabled rotation reframes refuge rooms as shared infrastructure.",
      },
      {
        speakerIndex: 4,
        category: "decisions",
        text: "Yes. We will fund western shade, two actively cooled teaching rooms, and the electrical design now; portable fans must include quiet, individually controllable options.",
        signal:
          "The school chooses a layered first phase with shared cooled rooms.",
      },
      {
        speakerIndex: 1,
        category: "actions",
        text: "I’ll verify circuits, installation dates, and sensor locations this week, then price the second-phase upgrade without assuming today’s equipment is reusable.",
        signal:
          "Facilities owns feasibility, timing, sensing, and honest second-phase costing.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "I’ll support that decision, but we have not addressed outdoor lunch areas or transport home. Our heat plan still begins and ends at the classroom door.",
        signal: "Heat exposure outside classrooms remains unresolved.",
      },
      {
        speakerIndex: 0,
        category: "evidence",
        text: "The bus queue is where students described headaches most often. There is no shade, and late buses turn a ten-minute wait into forty.",
        signal:
          "Student evidence extends heat exposure into the transport queue.",
      },
      {
        speakerIndex: 4,
        category: "constraints",
        text: "We cannot rebuild the transport area this term because the land belongs to the council, but we can change supervision and dismissal timing ourselves.",
        signal:
          "Property ownership limits construction while school-controlled changes remain possible.",
      },
      {
        speakerIndex: 3,
        category: "alternatives",
        text: "A temporary shade sail and a temperature-triggered indoor waiting option would test demand before either organisation commits to permanent construction.",
        signal:
          "Temporary shade and indoor waiting provide a reversible transport experiment.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Indoor waiting helps only if announcements are visual as well as spoken. Otherwise deaf students may miss the bus while using the safer space.",
        signal:
          "Accessible announcements are required for an indoor waiting option.",
      },
      {
        speakerIndex: 1,
        category: "positions",
        text: "I can install a portable display beside the hall entrance, but live bus data is unreliable. Staff may need a simple manual departure control.",
        signal:
          "A manual accessible departure display may be more reliable than live data.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "Who gets permission to wait inside? If students must prove they are heat-sensitive, the policy recreates the same disclosure problem as cooled classrooms.",
        signal:
          "Eligibility rules could create harmful disclosure requirements.",
      },
      {
        speakerIndex: 4,
        category: "decisions",
        text: "No individual proof. On trigger days the hall becomes an open waiting area, with visual departures and supervised movement to each bus.",
        signal: "The school chooses universal indoor waiting on trigger days.",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll bring the council into the shade test and compare queue temperature, indoor uptake, missed departures, and student comfort across the hottest school days.",
        signal:
          "The climate consultant owns a measurable outdoor and indoor waiting experiment.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "immediate cooling versus enabling long-term adaptation",
        "shared relief versus stigmatized access",
      ],
      emergingDecision:
        "Use a layered first phase of shade, shared cooled rooms, and electrical design.",
      ownedAction:
        "Owen will validate circuits, installation, sensing, and phase-two costs.",
      unresolvedConcern:
        "Outdoor and journey-home heat exposure remains outside the plan.",
    },
  },
  {
    slug: "bank-scam-warning",
    title: "Banking App: Scam Warning Without Panic",
    durationMinutes: 3,
    description:
      "A concept critique where fraud prevention, accessibility, customer autonomy, and support capacity collide around a high-friction payment warning.",
    topic: "A just-in-time scam intervention for unusual bank transfers",
    domain: "Financial safety and digital product design",
    workshopType: "concept_critique",
    objective:
      "Refine a scam-warning flow that interrupts coercion without shaming customers, blocking legitimate transfers, or revealing risk signals to an abuser.",
    phase: "evaluate",
    criteria: [
      "Prompts reflection without blame or panic",
      "Supports customers under coercion or surveillance",
      "Allows legitimate urgent transfers to proceed",
      "Connects to support that can meet resulting demand",
    ],
    difficulty: "challenging",
    crossTalkLevel: "occasional",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Inez",
        role: "fraud researcher",
        viewpoint: "behaviour during coercion and scam escalation",
        discourseStyle: "evidence-led and careful",
        habitualMove: "distinguishes customer behaviour from team assumptions",
        calibration:
          "I’m Inez, the fraud researcher. I’ll ground us in how people behave under urgency and coercion, and challenge language that turns vulnerability into blame.",
      },
      {
        name: "Marcus",
        role: "product designer",
        viewpoint: "a comprehensible interruption at the payment moment",
        discourseStyle: "exploratory and concrete",
        habitualMove: "translates critique into another interaction pattern",
        calibration:
          "I’m Marcus, the product designer. I’ll focus on whether the interruption is understandable in the moment and whether each choice leads somewhere coherent.",
      },
      {
        name: "Sofia",
        role: "customer support lead",
        viewpoint: "support capacity and difficult downstream conversations",
        discourseStyle: "direct and empathetic",
        habitualMove: "surfaces what happens after the interface ends",
        calibration:
          "I’m Sofia from customer support. I’ll examine the conversations this design creates, our response capacity, and what customers experience after choosing help.",
      },
      {
        name: "Caleb",
        role: "risk engineer",
        viewpoint: "detection quality, evasion, and lawful payment access",
        discourseStyle: "precise and skeptical",
        habitualMove: "tests edge cases without treating the model as certain",
        calibration:
          "I’m Caleb, the risk engineer. I’ll keep model uncertainty, evasion, false positives, and legitimate access visible while we shape the intervention.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 1,
        category: "positions",
        text: "The concept pauses an unusual transfer and asks, ‘Are you being scammed?’ with a sixty-second countdown before the customer can continue.",
        signal:
          "The initial concept uses a direct accusation and timed friction.",
      },
      {
        speakerIndex: 0,
        category: "evidence",
        text: "That wording failed in interviews. People defending the transfer treated it as the bank calling them foolish, so they rushed through to prove control.",
        signal:
          "Accusatory wording triggered defensiveness and faster dismissal.",
      },
      {
        speakerIndex: 3,
        category: "constraints",
        text: "The countdown is also a signal. A scammer watching the screen learns exactly when our intervention fires and can coach the customer through it.",
        signal:
          "Visible timed friction can help an observer evade the intervention.",
        overlap: "interruption",
      },
      {
        speakerIndex: 1,
        category: "questions",
        text: "Would a neutral pause work better—‘This payment differs from your usual activity’—followed by private ways to verify the recipient?",
        signal:
          "The designer proposes neutral anomaly framing and private verification.",
      },
      {
        speakerIndex: 2,
        category: "constraints",
        text: "Private verification cannot mean ‘call us now’ as the only path. Our fraud queue already spikes after media coverage, and callers may wait while someone is pressuring them.",
        signal:
          "A call-only support path is unsafe and exceeds support capacity.",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "We heard a useful phrase from participants: ‘I want time without cancelling.’ A quiet save-and-return option could create distance without forcing them to admit concern.",
        signal:
          "Save-and-return gives customers time without requiring a scam admission.",
        overlap: "eager_agreement",
      },
      {
        speakerIndex: 3,
        category: "positions",
        text: "I can support that if the draft expires and does not reveal the risk rule. But high-confidence mule patterns still need a stronger hold than reflection alone.",
        signal: "Different risk levels may require distinct interventions.",
      },
      {
        speakerIndex: 1,
        category: "themes",
        text: "So we have two jobs we collapsed: give uncertain cases a dignified exit, and route genuinely dangerous patterns into a controlled review.",
        signal:
          "The group separates reflective friction from high-risk review.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "What does controlled review promise? If the screen says ‘specialist available’ and nobody responds for forty minutes, we create false safety.",
        signal: "Support promises must match real response times.",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "For uncertain cases: save, verify through another channel, or continue after two contextual questions. For high risk: hold, show a realistic response window, and offer a safe-exit gesture.",
        signal:
          "A tiered intervention combines reflection, verification, and bounded review.",
      },
      {
        speakerIndex: 3,
        category: "evidence",
        text: "The model can support those bands, but we must test the boundary across new customers and people sending remittances; both currently attract more false positives.",
        signal:
          "Risk-band fairness for new customers and remittance senders needs testing.",
      },
      {
        speakerIndex: 1,
        category: "decisions",
        text: "We’ll remove the countdown and accusation. The next prototype uses neutral context, save-and-return, channel verification, and a separate high-risk review with honest timing.",
        signal:
          "The team chooses a neutral tiered intervention without countdown pressure.",
      },
      {
        speakerIndex: 2,
        category: "actions",
        text: "I’ll define the response windows we can actually staff and draft what happens when that window slips, including asynchronous follow-up that does not expose the customer.",
        signal:
          "Support owns credible service levels and a discreet delayed-response path.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "We still need research with people experiencing financial abuse. A safe-exit gesture designed without them could be obvious to the person watching.",
        signal: "Co-design of the safe-exit interaction remains unresolved.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "protective friction versus customer dignity and autonomy",
        "support promises versus operational capacity",
      ],
      emergingDecision:
        "Prototype a neutral, tiered intervention without a countdown.",
      ownedAction:
        "Sofia will define credible support windows and discreet fallback handling.",
      unresolvedConcern:
        "The safe-exit gesture needs co-design with financial-abuse survivors.",
    },
  },
  {
    slug: "warehouse-handover-retro",
    title: "Warehouse: Shift Handover Retrospective",
    durationMinutes: 4,
    description:
      "A blameless operations retrospective that surfaces conflicting accounts, informal workarounds, safety signals, and ownership across day and night shifts.",
    topic: "Missed replenishment alerts during warehouse shift handover",
    domain: "Operations, safety, and team learning",
    workshopType: "retrospective",
    objective:
      "Identify the system conditions behind a delayed replenishment without blaming individuals, then agree on a measurable handover experiment.",
    phase: "reflect",
    criteria: [
      "Separates observed events from attribution",
      "Makes cross-shift information loss visible",
      "Protects safety while reducing duplicate work",
      "Ends with an owned and measurable experiment",
    ],
    difficulty: "realistic",
    crossTalkLevel: "frequent",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Keisha",
        role: "night-shift picker",
        viewpoint: "floor conditions and informal recovery work",
        discourseStyle: "candid and concrete",
        habitualMove:
          "corrects process descriptions with what actually happens",
        calibration:
          "I’m Keisha from the night picking team. I’ll describe what happened on the floor, including the workarounds that are easy to miss in reports.",
      },
      {
        name: "Ben",
        role: "day-shift supervisor",
        viewpoint: "handover accountability and throughput",
        discourseStyle: "fast and solution-oriented",
        habitualMove: "pushes toward a rule before all conditions are visible",
        calibration:
          "I’m Ben, the day-shift supervisor. I’ll focus on handover accountability and throughput, and I want us to leave with a rule we can run.",
      },
      {
        name: "Lulu",
        role: "safety representative",
        viewpoint: "fatigue, interruption, and near-miss learning",
        discourseStyle: "calm and persistent",
        habitualMove: "slows attribution and asks about system conditions",
        calibration:
          "I’m Lulu, the safety representative. I’ll keep fatigue, interruption, and near-miss evidence visible and stop us from converting uncertainty into personal blame.",
      },
      {
        name: "Harish",
        role: "workflow systems analyst",
        viewpoint: "alert design, logs, and measurable process experiments",
        discourseStyle: "analytical but collaborative",
        habitualMove:
          "tests stories against timestamps and proposes instrumentation",
        calibration:
          "I’m Harish, the workflow analyst. I’ll compare our stories with system timestamps and turn a plausible cause into an instrumented process experiment.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 1,
        category: "positions",
        text: "The replenishment alert sat unacknowledged for forty minutes. My first reaction is that handover needs a named owner who signs off every open alert.",
        signal:
          "The supervisor initially attributes the delay to unclear ownership.",
      },
      {
        speakerIndex: 0,
        category: "evidence",
        text: "It was acknowledged on the handheld. The problem was the aisle had been closed after a pallet wrap tore, so I wrote it on the dock board.",
        signal:
          "The alert was acknowledged but blocked by an unrepresented safety closure.",
      },
      {
        speakerIndex: 3,
        category: "evidence",
        text: "The log supports Keisha: acknowledgement at 5:41, aisle scan at 5:44, then no system event until reopening. The dock board is not captured.",
        signal: "System logs omit the physical-board handover state.",
        overlap: "eager_agreement",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Why did the board become the fallback? Was the closure field unavailable, or did entering it require leaving the clean-up area?",
        signal: "The group investigates why the workaround was necessary.",
      },
      {
        speakerIndex: 0,
        category: "constraints",
        text: "The closure menu takes four screens, and gloves miss the small options. I was also keeping people away from the torn wrap, so the board was faster.",
        signal:
          "The digital closure flow conflicts with gloved, safety-critical work.",
      },
      {
        speakerIndex: 1,
        category: "positions",
        text: "I did not know any of that. I saw an open job and an empty board because cleaning had already wiped it for the day shift.",
        signal:
          "The day shift received neither the digital state nor the temporary physical state.",
        overlap: "interruption",
      },
      {
        speakerIndex: 2,
        category: "themes",
        text: "Then this is not one missed alert. We have two handover systems with different reset times, and safety work is visible in only one of them.",
        signal:
          "Mismatched handover channels and reset times are the systemic cause.",
      },
      {
        speakerIndex: 3,
        category: "alternatives",
        text: "We can add a one-tap ‘blocked—safety’ state on the scanner, but that alone will not explain location, expected reopening, or who is watching it.",
        signal: "A quick blocked state helps but lacks context and ownership.",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "Give me one tap first, then let the next shift add detail at the desk. During a spill or tear, requiring a paragraph means people will still use the board.",
        signal:
          "Capture minimal state at the hazard, then enrich it during handover.",
        overlap: "interruption",
      },
      {
        speakerIndex: 1,
        category: "questions",
        text: "I can work with that, but who receives the incomplete state? If it lands in the same alert list, the day lead may still treat it as ordinary replenishment.",
        signal: "Safety-blocked work needs distinct visibility at handover.",
      },
      {
        speakerIndex: 2,
        category: "alternatives",
        text: "Make safety blocks a separate handover queue that cannot be cleared by board cleaning. The incoming lead confirms the condition, not the person’s performance.",
        signal:
          "A persistent safety queue reframes sign-off around conditions, not blame.",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll prototype the one-tap state and persistent queue, then compare capture time, unresolved duration, and duplicate dispatches across two paired shifts.",
        signal: "The analyst owns an instrumented two-shift experiment.",
      },
      {
        speakerIndex: 1,
        category: "decisions",
        text: "Let’s test that instead of adding a blanket sign-off. I’m changing my view: ownership was missing because the condition disappeared, not because nobody cared.",
        signal:
          "The supervisor revises the blame-based hypothesis and adopts the queue experiment.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "Good, but please include agency staff. They share the same hazards and handhelds, yet they are often absent from the formal handover briefing.",
        signal:
          "Inclusion of agency staff remains an unresolved process concern.",
      },
      {
        speakerIndex: 2,
        category: "evidence",
        text: "Agency staff also rotate zones more often. A queue tied only to the person who logged an issue may become invisible as soon as they move.",
        signal:
          "Rotating assignments make person-owned issue queues unreliable.",
      },
      {
        speakerIndex: 3,
        category: "alternatives",
        text: "Attach each open condition to both a zone and a temporary owner, then require reassignment rather than silently dropping ownership at logout.",
        signal:
          "Dual zone and person ownership preserves conditions across staff rotation.",
      },
      {
        speakerIndex: 1,
        category: "constraints",
        text: "Reassignment cannot become another end-of-shift form. The outgoing lead needs one view showing only unresolved hazards and blocked replenishment.",
        signal:
          "The handover view must stay focused enough to avoid administrative overhead.",
      },
      {
        speakerIndex: 0,
        category: "actions",
        text: "I’ll test that view with agency pickers on both shifts and record what they notice, what they miss, and whether ownership survives reassignment.",
        signal:
          "Night-shift staff own inclusive testing of the revised handover view.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "individual accountability versus disappearing system state",
        "fast hazard response versus complete digital documentation",
      ],
      emergingDecision:
        "Test a one-tap safety block with a persistent handover queue.",
      ownedAction:
        "Harish will prototype and measure the paired-shift experiment.",
      unresolvedConcern:
        "Agency workers are still outside the formal handover loop.",
    },
  },
  {
    slug: "museum-sensory-wayfinding",
    title: "Museum: Sensory-Friendly Wayfinding Synthesis",
    durationMinutes: 5,
    description:
      "A research-synthesis workshop where conflicting visitor behaviours challenge a proposed quiet route and expose gaps between maps, staff practice, and sensory conditions.",
    topic: "Synthesizing research for sensory-friendly museum wayfinding",
    domain: "Culture, accessibility, and visitor experience",
    workshopType: "user_research_synthesis",
    objective:
      "Turn mixed field evidence into a testable wayfinding hypothesis without flattening different sensory, cognitive, and family needs into one persona.",
    phase: "synthesize",
    criteria: [
      "Preserves meaningful differences between visitor needs",
      "Connects findings to observed behaviour",
      "Works across signs, digital maps, and staff interactions",
      "Produces a falsifiable next research question",
    ],
    difficulty: "realistic",
    crossTalkLevel: "occasional",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Elena",
        role: "visitor researcher",
        viewpoint: "behavioural evidence and contradictions across visits",
        discourseStyle: "curious and precise",
        habitualMove: "asks whether a pattern survives across participants",
        calibration:
          "I’m Elena, the visitor researcher. I’ll distinguish repeated behaviour from vivid anecdotes and keep contradictions visible instead of averaging them away.",
      },
      {
        name: "Kwame",
        role: "exhibition designer",
        viewpoint: "spatial sequence, visual hierarchy, and exhibit intent",
        discourseStyle: "associative and visual",
        habitualMove: "connects a finding to a spatial intervention",
        calibration:
          "I’m Kwame, the exhibition designer. I’ll connect visitor behaviour to spatial sequence and visual hierarchy while protecting the intent of the exhibits.",
      },
      {
        name: "Hannah",
        role: "access consultant",
        viewpoint:
          "sensory and cognitive access without a single-user assumption",
        discourseStyle: "measured and challenging",
        habitualMove:
          "asks which access need an apparent solution disadvantages",
        calibration:
          "I’m Hannah, the access consultant. I’ll test whether our patterns hold across sensory and cognitive needs and flag solutions that help one group by excluding another.",
      },
      {
        name: "Ravi",
        role: "front-of-house manager",
        viewpoint:
          "staff explanations, crowd conditions, and daily variability",
        discourseStyle: "story-led and practical",
        habitualMove:
          "introduces operational context missing from the research artifact",
        calibration:
          "I’m Ravi from front of house. I’ll add crowd and staffing context, especially where the same route behaves differently by hour or event.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 0,
        category: "evidence",
        text: "The strongest cluster is not ‘visitors want fewer choices.’ It is that people need to know the sensory consequence of a choice before committing to a corridor.",
        signal:
          "Visitors need predictive sensory information rather than fewer choices.",
      },
      {
        speakerIndex: 2,
        category: "themes",
        text: "That distinction matters.",
        signal:
          "The access consultant acknowledges the predictive-information distinction.",
        pauseBeforeMs: 180,
      },
      {
        speakerIndex: 1,
        category: "positions",
        text: "That challenges our quiet-route concept. We designed one continuous low-stimulation path, but it hides the main gallery and removes opportunities to rejoin.",
        signal:
          "A single quiet route restricts choice and access to key exhibits.",
      },
      {
        speakerIndex: 2,
        category: "evidence",
        text: "And ‘quiet’ was not consistent. One visitor needed low sound but strong visual landmarks; another found our high-contrast arrows more difficult than the ambient noise.",
        signal:
          "Sensory needs vary by modality, so a single quiet label is misleading.",
        overlap: "interruption",
      },
      {
        speakerIndex: 3,
        category: "constraints",
        text: "Conditions change too. The atrium is calm at opening and loud after school groups arrive. A permanent sign cannot honestly describe both states.",
        signal:
          "Time-varying crowd conditions make static sensory labels incomplete.",
      },
      {
        speakerIndex: 1,
        category: "questions",
        text: "Are we actually designing a route, then, or a set of decision points that reveal current sound, light, crowding, and ways back?",
        signal:
          "The concept reframes from one route to informed decision points.",
      },
      {
        speakerIndex: 0,
        category: "themes",
        text: "Decision points fit the observations better. Families often paused at thresholds, negotiated what was manageable, and then split or changed direction without asking staff.",
        signal: "Threshold negotiation is a recurring behavioural pattern.",
      },
      {
        speakerIndex: 1,
        category: "themes",
        text: "That pattern matters.",
        signal:
          "The designer acknowledges threshold negotiation as a design signal.",
        overlap: "backchannel",
      },
      {
        speakerIndex: 2,
        category: "constraints",
        text: "But live crowd indicators cannot become another moving visual layer. Some visitors deliberately avoid screens, and colour-only status would recreate the original barrier.",
        signal:
          "Dynamic status must not depend on screens, motion, or colour alone.",
      },
      {
        speakerIndex: 3,
        category: "alternatives",
        text: "Staff already update wait-time boards. We could trial simple tactile cards at three thresholds, with symbols for sound, light, seating, and a timestamp.",
        signal:
          "Existing staff practice can support low-tech, timestamped sensory status cards.",
      },
      {
        speakerIndex: 1,
        category: "positions",
        text: "I was pushing for a seamless branded trail, but the evidence favours visible escape and re-entry. The interruptions may be the service, not a design failure.",
        signal:
          "The designer revises the seamless-route assumption in favour of exit and re-entry.",
        overlap: "eager_agreement",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "How will we know whether the cards support agency rather than making people more anxious by listing hazards at every turn?",
        signal:
          "The test must distinguish informed agency from increased anticipatory anxiety.",
      },
      {
        speakerIndex: 2,
        category: "alternatives",
        text: "Offer preferred conditions as well as intensity: seating ahead, daylight available, quiet exit nearby. That frames choice around support, not only warning.",
        signal:
          "Sensory information should include available supports, not just hazards.",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll map which threshold information staff can update reliably and observe the time cost during a school-group day and a quiet weekday.",
        signal:
          "Front of house owns a reliability and workload test across conditions.",
      },
      {
        speakerIndex: 1,
        category: "decisions",
        text: "We’ll test three supported-choice thresholds instead of building the full quiet route: tactile static cues, timestamped conditions, seating, exits, and clear re-entry paths.",
        signal:
          "The team chooses a small supported-choice threshold prototype.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "We still lack evidence from visitors who do not read English or standard pictograms. The prototype should expose that gap, not present the symbols as universal.",
        signal:
          "Language and symbol comprehension remain unresolved research gaps.",
      },
      {
        speakerIndex: 2,
        category: "evidence",
        text: "In the last access walk, two visitors followed the colour band but interpreted the ear symbol as an audio-guide point, not a quieter route.",
        signal:
          "Existing symbols create a specific and consequential interpretation error.",
      },
      {
        speakerIndex: 1,
        category: "positions",
        text: "Then more pictograms may increase confidence without understanding. The route needs redundant cues that visitors can learn from the space itself.",
        signal:
          "Spatial redundancy is preferred over a denser symbolic vocabulary.",
      },
      {
        speakerIndex: 3,
        category: "constraints",
        text: "Staff can point to landmarks, but those change with temporary exhibitions. Spoken directions must survive a gallery change without retraining everyone.",
        signal:
          "Changing exhibitions make landmark-dependent guidance fragile.",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "Could we test stable floor texture, numbered thresholds, and a take-away card together, then observe which cue people use and compare hesitation when one becomes ambiguous?",
        signal:
          "A redundant multi-cue prototype can reveal recovery from ambiguity.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Only if the floor texture is detectable by cane and does not become a trip edge. Include mobility access in the same trial.",
        signal:
          "Tactile navigation must be evaluated alongside mobility safety.",
      },
      {
        speakerIndex: 1,
        category: "decisions",
        text: "Agreed. We’ll prototype one threshold at full scale rather than spreading untested cues across the route, and retain the staffed choice point beside it.",
        signal:
          "The team narrows the test to one full-scale supported threshold.",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll schedule the trial across a school-group morning and a quieter afternoon, recording requests for repetition, escort, exit, and re-entry.",
        signal:
          "Front-of-house owns observation across contrasting operating conditions.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "We should still recruit across languages directly. Observing confusion after opening cannot replace involving those visitors before we settle the cue set and staff guidance across quiet and crowded operating periods before launch in practice.",
        signal:
          "Direct multilingual participation remains necessary before finalizing cues.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "one seamless quiet route versus reversible visitor choice",
        "dynamic sensory information versus cognitive and visual load",
      ],
      emergingDecision: "Test three low-tech supported-choice thresholds.",
      ownedAction: "Ravi will validate update reliability and staff workload.",
      unresolvedConcern:
        "Language and pictogram comprehension are not yet represented.",
    },
  },
  {
    slug: "hiring-ai-review-boundaries",
    title: "Hiring Assistant: Human Review Boundaries",
    durationMinutes: 5,
    description:
      "A governance-oriented design review of an AI-assisted applicant triage flow, with disagreement about efficiency, explanation, disability disclosure, and accountable human judgment.",
    topic: "Human review and explanation in AI-assisted recruitment triage",
    domain: "Responsible AI and organisational decision design",
    workshopType: "design_review",
    objective:
      "Define where automation may support triage, where human review is mandatory, and what applicants and recruiters must be able to understand or contest.",
    phase: "evaluate",
    criteria: [
      "Preserves accountable human judgment",
      "Supports meaningful applicant explanation and contest",
      "Avoids penalising disability, career gaps, or non-standard experience",
      "Reduces administrative work without hiding uncertainty",
    ],
    difficulty: "challenging",
    crossTalkLevel: "frequent",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Yasmin",
        role: "recruitment operations lead",
        viewpoint: "review capacity, consistency, and candidate communication",
        discourseStyle: "direct and process-focused",
        habitualMove: "asks what staff must do at scale",
        calibration:
          "I’m Yasmin from recruitment operations. I’ll focus on reviewer capacity, consistency, candidate communication, and which proposed safeguards can actually run at hiring volume.",
      },
      {
        name: "Tom",
        role: "machine learning lead",
        viewpoint: "bounded model use, uncertainty, and monitoring",
        discourseStyle: "precise and responsive",
        habitualMove: "separates model capability from product policy",
        calibration:
          "I’m Tom, the machine learning lead. I’ll separate what the model estimates from what the product decides and make uncertainty and monitoring explicit.",
      },
      {
        name: "Amara",
        role: "disability inclusion specialist",
        viewpoint: "access, disclosure risk, and non-standard career evidence",
        discourseStyle: "calm and uncompromising",
        habitualMove: "surfaces who bears the cost of an efficiency gain",
        calibration:
          "I’m Amara, the disability inclusion specialist. I’ll examine disclosure risk, accommodation, non-standard work histories, and who absorbs the cost of automated efficiency.",
      },
      {
        name: "Felix",
        role: "hiring manager",
        viewpoint: "role relevance and the quality of shortlists",
        discourseStyle: "skeptical and example-driven",
        habitualMove: "tests policy against a concrete vacancy",
        calibration:
          "I’m Felix, a hiring manager. I’ll test the workflow against real role decisions and whether the shortlist preserves evidence I need to exercise judgment.",
      },
      {
        name: "Noor",
        role: "employment counsel",
        viewpoint: "accountability, documentation, and contestability",
        discourseStyle: "measured and clarifying",
        habitualMove:
          "asks who can explain and defend a consequential decision",
        calibration:
          "I’m Noor, employment counsel. I’ll track who remains accountable, what gets documented, and whether a rejected applicant can receive and contest a meaningful reason.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 0,
        category: "positions",
        text: "The proposal ranks every application, sends the top group to managers, and routes borderline scores to recruiters. That would remove the first manual pass.",
        signal:
          "The initial proposal automates first-pass ranking and uses scores for routing.",
      },
      {
        speakerIndex: 2,
        category: "constraints",
        text: "It also turns absence into evidence. A candidate who omits a career gap explanation or accommodation history may look less complete precisely because disclosure felt unsafe.",
        signal:
          "Missing information may reflect disclosure risk rather than weak qualification.",
      },
      {
        speakerIndex: 1,
        category: "positions",
        text: "The model does not use an accommodation field, but I accept the broader point: embeddings still reflect what is present and cannot explain why something is absent.",
        signal:
          "Excluding a sensitive field does not remove proxy and missingness risks.",
        overlap: "interruption",
      },
      {
        speakerIndex: 3,
        category: "evidence",
        text: "For the service designer role, strong candidates often describe community work differently from agency projects. A ranked cutoff could erase exactly the range we want.",
        signal:
          "Non-standard experience can be role-relevant despite ranking differences.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "If ranking is too consequential, can the assistant cluster evidence against published criteria and let recruiters decide the order? We still need workload relief.",
        signal:
          "The automation target shifts from ranking people to organising evidence.",
      },
      {
        speakerIndex: 4,
        category: "constraints",
        text: "That is safer only if the human sees source text and uncertainty. A polished summary can become the de facto decision even when policy says it is advisory.",
        signal:
          "Human review requires source evidence and visible uncertainty, not a persuasive summary alone.",
        overlap: "interruption",
      },
      {
        speakerIndex: 1,
        category: "alternatives",
        text: "We can show criterion-linked excerpts, mark unsupported criteria as unknown, and avoid a total score. The model would retrieve and organise, not recommend rejection.",
        signal:
          "A no-score evidence organiser offers a bounded use of the model.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "How does a candidate correct an excerpt taken out of context? Internal source links help recruiters, but contestability cannot exist only behind the company login.",
        signal:
          "Applicant-facing correction needs more than internal traceability.",
      },
      {
        speakerIndex: 3,
        category: "positions",
        text: "I would use the evidence view, but I do not want applicants debating every shortlist choice before interview. We need a boundary around what contest means.",
        signal:
          "Meaningful contest must be balanced with a workable hiring process.",
      },
      {
        speakerIndex: 4,
        category: "themes",
        text: "The boundary can follow consequence: correction before a human decision, a reason after rejection, and escalation where the reason rests on disputed or inaccessible evidence.",
        signal: "Contest mechanisms should scale with decision consequence.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "That adds recruiter work. Could we first test whether evidence clustering actually saves time once reviewers verify excerpts and handle corrections?",
        signal:
          "Efficiency claims must include verification and correction work.",
      },
      {
        speakerIndex: 1,
        category: "actions",
        text: "I’ll build an offline evaluation with source-linked evidence, no scores, and explicit unknowns. We can measure verification time and disagreement by criterion.",
        signal: "The ML lead owns an offline, no-score evidence evaluation.",
      },
      {
        speakerIndex: 0,
        category: "decisions",
        text: "Then we will not ship ranked routing. We’ll test criterion evidence with mandatory human review, source visibility, correction before decision, and documented rejection reasons.",
        signal:
          "The team rejects automated ranking and chooses source-linked human review.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "I support the test, but success cannot be average agreement alone. We still need a plan for small groups whose harms disappear inside aggregate metrics.",
        signal: "Subgroup evaluation with sparse data remains unresolved.",
      },
      {
        speakerIndex: 4,
        category: "positions",
        text: "The review record must preserve disagreement, not just the final disposition. Otherwise an appeal cannot show which uncertainty the decision-maker accepted.",
        signal:
          "Accountability requires preserving reviewer disagreement and accepted uncertainty.",
      },
      {
        speakerIndex: 3,
        category: "constraints",
        text: "Hiring managers will resist another narrative field if every candidate requires an essay. We need structure without turning judgment into a hidden score.",
        signal:
          "Review documentation must balance accountability with operational effort.",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "Use three prompts: evidence relied on, uncertainty remaining, and reason for advancing or declining. Answers can be short, but none can be blank.",
        signal:
          "Three mandatory prompts provide concise, inspectable human reasoning.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Where does accommodation information sit? It must change the process when relevant without becoming evidence against the person in the hiring decision.",
        signal:
          "Accommodation data needs strict separation from evaluative evidence.",
      },
      {
        speakerIndex: 4,
        category: "decisions",
        text: "Accommodation requests stay in a separate access workflow. The review tool may confirm an adjustment occurred, but cannot expose the request or diagnosis.",
        signal:
          "The team separates accommodation operations from candidate evaluation.",
      },
      {
        speakerIndex: 1,
        category: "evidence",
        text: "That separation improves the offline test too. We can evaluate criterion evidence without feeding sensitive accommodation text into the model or its logs.",
        signal:
          "Data separation reduces model exposure while improving evaluation validity.",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll run the structured review with two panels and compare completion time, disagreement visibility, corrections, and decisions changed after source checking.",
        signal:
          "The hiring manager owns a panel-based evaluation of the review record.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Include an appeal exercise with deliberately ambiguous evidence. We still need to learn whether a rejected applicant can meaningfully challenge the recorded reason.",
        signal:
          "Meaningful appeal remains an explicit unresolved evaluation requirement.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "administrative efficiency versus consequential automated ranking",
        "internal traceability versus applicant-facing contestability",
      ],
      emergingDecision:
        "Test no-score, source-linked evidence organisation with mandatory human review.",
      ownedAction:
        "Tom will run an offline evaluation including verification cost.",
      unresolvedConcern: "Sparse subgroup harms need an evaluation approach.",
    },
  },
  {
    slug: "shelter-intake-framing",
    title: "Emergency Shelter: Trauma-Informed Intake",
    durationMinutes: 3,
    description:
      "A problem-framing session that challenges a faster digital intake concept by exposing safety, repetition, translation, staff discretion, and data-retention tensions.",
    topic: "Reframing emergency-shelter intake around safety and continuity",
    domain: "Public service and trauma-informed design",
    workshopType: "problem_framing",
    objective:
      "Agree on the right intake problem before prototyping, including what information is necessary now, what can wait, and how prior disclosures travel safely.",
    phase: "frame",
    criteria: [
      "Minimises repeated traumatic disclosure",
      "Preserves immediate safety and informed consent",
      "Works with interpreters and low literacy",
      "Collects only information needed for a clear service purpose",
    ],
    difficulty: "challenging",
    crossTalkLevel: "none",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Celeste",
        role: "shelter service designer",
        viewpoint: "continuity across arrival, placement, and referral",
        discourseStyle: "reflective and synthesizing",
        habitualMove:
          "reframes the problem when evidence contradicts the brief",
        calibration:
          "I’m Celeste, the service designer. I’ll trace where information and responsibility move, and I’m prepared to reframe the brief if speed is not the real problem.",
      },
      {
        name: "Mariam",
        role: "survivor advocate",
        viewpoint: "agency, disclosure safety, and unequal consequences",
        discourseStyle: "plain and deliberate",
        habitualMove: "asks why the service needs a sensitive answer now",
        calibration:
          "I’m Mariam, the survivor advocate. I’ll ask why each disclosure is needed now, who can see it, and what refusing to answer changes.",
      },
      {
        name: "George",
        role: "intake coordinator",
        viewpoint: "night-shift decisions and limited placement capacity",
        discourseStyle: "practical and candid",
        habitualMove: "tests concepts against a pressured arrival",
        calibration:
          "I’m George, the intake coordinator. I’ll test ideas against night arrivals, limited beds, interpreter delays, and the decisions staff must make immediately.",
      },
      {
        name: "Lin",
        role: "data protection officer",
        viewpoint: "purpose limitation, access, and retention",
        discourseStyle: "precise but collaborative",
        habitualMove: "links a field to its service purpose and access path",
        calibration:
          "I’m Lin, the data protection officer. I’ll connect every sensitive field to a purpose, access rule, retention period, and safe correction path.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 0,
        category: "positions",
        text: "The brief asks us to reduce a forty-minute intake to fifteen by moving the questionnaire onto a tablet before the person speaks with staff.",
        signal: "The original brief defines intake time as the main problem.",
      },
      {
        speakerIndex: 1,
        category: "evidence",
        text: "People did not describe the form as merely slow. They described telling the same dangerous story three times because no one trusted the earlier record.",
        signal:
          "Repeated disclosure and broken trust, not form length alone, drive harm.",
      },
      {
        speakerIndex: 2,
        category: "constraints",
        text: "At two in the morning I still need enough information to place someone safely. If we remove questions, staff will ask them verbally under more pressure.",
        signal:
          "Immediate placement decisions require bounded safety information.",
      },
      {
        speakerIndex: 3,
        category: "questions",
        text: "Which answers actually determine tonight’s placement, and which are collected because another programme may want them next week? Those are different purposes.",
        signal:
          "The group distinguishes immediate placement data from later programme data.",
      },
      {
        speakerIndex: 2,
        category: "evidence",
        text: "Immediate: household members, urgent medical access, mobility, and whether a known person creates a location risk. Employment history can wait; we never use it overnight.",
        signal: "Staff identify a small immediate-placement data set.",
      },
      {
        speakerIndex: 1,
        category: "constraints",
        text: "Even ‘known person’ is risky on a visible tablet. Someone may arrive with the person controlling them, or an interpreter may come from the same community.",
        signal:
          "Sensitive safety disclosure needs a private channel and interpreter safeguards.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "Then maybe intake is not one form. Could we establish immediate needs privately, place the person, and offer later modules only when their purpose becomes relevant?",
        signal:
          "The intake concept shifts from one comprehensive form to staged disclosure.",
      },
      {
        speakerIndex: 3,
        category: "alternatives",
        text: "Staging also lets consent be specific. The person can see who receives each later module and decline without accidentally losing tonight’s bed.",
        signal:
          "Staged modules enable purpose-specific consent without service coercion.",
      },
      {
        speakerIndex: 2,
        category: "positions",
        text: "I was worried this would slow placement, but four required needs plus a private staff check is probably faster than correcting a long incomplete form.",
        signal:
          "The coordinator revises the assumption that comprehensive intake is faster.",
      },
      {
        speakerIndex: 1,
        category: "themes",
        text: "The design principle is continuity with control: do not make someone repeat a disclosure, but do not make the record travel further than they expect.",
        signal: "Continuity and user control must coexist.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "What happens when the first record is wrong? Preserving a mistaken risk note across services could be more harmful than asking again.",
        signal: "Continuity requires visible correction and provenance.",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll map purpose, access, expiry, and correction for every proposed field, then mark which data can travel only with a fresh consent event.",
        signal:
          "Data protection owns a field-level purpose and correction map.",
      },
      {
        speakerIndex: 0,
        category: "decisions",
        text: "We’ll reframe the prototype around staged intake: four immediate needs, a private safety check, visible correction, and optional purpose-specific modules after placement.",
        signal:
          "The team chooses staged intake rather than digitising the full questionnaire.",
      },
      {
        speakerIndex: 1,
        category: "questions",
        text: "That is the right frame, but we have not involved people turned away when beds were full. Their data and safety journey may be entirely different.",
        signal:
          "The experience of people denied placement remains unrepresented.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "faster intake versus safer staged disclosure",
        "information continuity versus consent and correction",
      ],
      emergingDecision:
        "Prototype four immediate needs plus private, staged modules.",
      ownedAction:
        "Lin will map purpose, access, expiry, and correction by field.",
      unresolvedConcern:
        "People denied a bed are absent from the current research.",
    },
  },
  {
    slug: "hybrid-release-incident",
    title: "Incident Review: Hybrid Release Breakdown",
    durationMinutes: 4,
    description:
      "A blameless incident review of a failed release where remote participation, ambiguous approval, monitoring gaps, and status pressure create competing explanations.",
    topic:
      "Learning from a production release that failed across a hybrid team",
    domain: "Software delivery and organisational learning",
    workshopType: "retrospective",
    objective:
      "Build a shared causal account of the release failure and select safeguards that improve detection and decision clarity without adding ceremonial approvals.",
    phase: "reflect",
    criteria: [
      "Uses evidence rather than hindsight blame",
      "Includes remote and asynchronous work conditions",
      "Improves detection and decision clarity",
      "Assigns experiments rather than vague vigilance",
    ],
    difficulty: "realistic",
    crossTalkLevel: "frequent",
    participationProfile: "dominant_facilitator",
    speakers: [
      {
        name: "June",
        role: "incident facilitator",
        viewpoint: "a shared causal account without forced consensus",
        discourseStyle: "economical and probing",
        habitualMove: "separates timeline evidence from interpretation",
        calibration:
          "I’m June, facilitating the review. I’ll separate timeline evidence from interpretation, preserve disagreement, and make sure our actions test a causal claim.",
      },
      {
        name: "Arun",
        role: "release engineer",
        viewpoint: "deployment tooling and operational decision points",
        discourseStyle: "technical and candid",
        habitualMove: "names what the tools showed at the time",
        calibration:
          "I’m Arun, the release engineer. I’ll describe what the deployment tools showed in the moment and where I made judgment calls under pressure.",
      },
      {
        name: "Bea",
        role: "remote backend engineer",
        viewpoint: "asynchronous warnings and service-level behaviour",
        discourseStyle: "precise and occasionally frustrated",
        habitualMove: "surfaces information missed by the room",
        calibration:
          "I’m Bea, the backend engineer joining remotely. I’ll surface asynchronous warnings, service behaviour, and where the room’s conversation did not reach me.",
      },
      {
        name: "Malik",
        role: "product manager",
        viewpoint: "customer commitments and release communication",
        discourseStyle: "reflective and outcome-focused",
        habitualMove: "connects schedule pressure to decision framing",
        calibration:
          "I’m Malik, the product manager. I’ll make customer commitments and schedule pressure explicit, including how my language may have shaped the go decision.",
      },
      {
        name: "Sora",
        role: "site reliability engineer",
        viewpoint: "monitoring coverage, rollback, and recovery time",
        discourseStyle: "calm and evidence-led",
        habitualMove: "tests claims against telemetry and failure modes",
        calibration:
          "I’m Sora from reliability. I’ll test our explanations against telemetry, rollback behaviour, and whether the proposed safeguards would detect this failure earlier.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 0,
        category: "evidence",
        text: "The deploy began at 16:02, synthetic checks stayed green, customer errors rose at 16:11, and rollback started at 16:27. What did each of us see before 16:11?",
        signal:
          "The facilitator establishes a shared timeline and evidence question.",
      },
      {
        speakerIndex: 1,
        category: "evidence",
        text: "I saw green checks and a thumbs-up in the room chat. I took that as approval to continue the database step, which made rollback slower.",
        signal:
          "Ambiguous chat approval influenced an irreversible deployment step.",
      },
      {
        speakerIndex: 2,
        category: "evidence",
        text: "I had posted that replica lag was climbing, but my message landed in the service thread, not the release thread. Nobody acknowledged it.",
        signal: "A relevant remote warning was fragmented across channels.",
        overlap: "interruption",
      },
      {
        speakerIndex: 3,
        category: "positions",
        text: "I remember saying we should avoid another delay. I did not mean ‘ignore risk,’ but I can hear how that sounded like a decision from the room.",
        signal:
          "Schedule language created implicit pressure despite no explicit approval.",
      },
      {
        speakerIndex: 4,
        category: "constraints",
        text: "Our synthetic check could not see replica lag because it reads the primary. The dashboard had the signal, but it was not in the release gate.",
        signal:
          "Monitoring coverage omitted the failure mode from the release gate.",
      },
      {
        speakerIndex: 0,
        category: "themes",
        text: "I hear three coupled gaps: incomplete telemetry, approval inferred from social cues, and relevant evidence split between the physical room and two channels.",
        signal:
          "The group identifies interacting technical and communication conditions.",
      },
      {
        speakerIndex: 1,
        category: "positions",
        text: "My first thought was another mandatory approver, but that would still fail if the approver sees green checks and misses Bea’s warning.",
        signal:
          "The release engineer rejects approval ceremony without better evidence.",
        overlap: "interruption",
      },
      {
        speakerIndex: 2,
        category: "alternatives",
        text: "Could the release command open one decision record that collects gates, warnings, remote acknowledgements, and the named person choosing continue or stop?",
        signal:
          "A single decision record could unify evidence and explicit authority.",
      },
      {
        speakerIndex: 4,
        category: "positions",
        text: "Yes, if it blocks only on defined signals. A free-form checklist will grow until people click through it. Replica lag needs a threshold and rollback trigger.",
        signal:
          "Decision support needs defined signals rather than checklist ceremony.",
      },
      {
        speakerIndex: 3,
        category: "questions",
        text: "Where does customer pressure appear? Hiding the launch commitment would make the record look objective while the same pressure moves into side conversations.",
        signal:
          "The decision record must make schedule pressure visible rather than pretending neutrality.",
        overlap: "interruption",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "Add a context field for commitments and consequences, but keep go authority explicit. That lets pressure be discussed without turning it into an unnamed approval.",
        signal:
          "Decision context and authority should be explicit but separate.",
      },
      {
        speakerIndex: 4,
        category: "actions",
        text: "I’ll add replica-lag telemetry to the canary gate and rehearse rollback before the next schema release, measuring detection and recovery time.",
        signal:
          "Reliability owns telemetry and rollback rehearsal with measurable outcomes.",
      },
      {
        speakerIndex: 1,
        category: "decisions",
        text: "We’ll pilot one release decision record with named authority, consolidated remote warnings, defined gates, and visible commitment context—not an extra approval layer.",
        signal:
          "The team chooses explicit, evidence-rich release decisions over more approvals.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "That helps planned releases. We still have no equivalent for emergency changes, where there is no room, fewer people, and much less time.",
        signal: "Emergency-change decision design remains unresolved.",
      },
      {
        speakerIndex: 0,
        category: "questions",
        text: "What is the minimum evidence an emergency decision still needs? If we cannot name it now, urgency will erase the record when risk is highest.",
        signal:
          "The team must define a minimum emergency evidence set before the next incident.",
      },
      {
        speakerIndex: 4,
        category: "alternatives",
        text: "Require impact observed, rollback path, decision owner, and one dissent channel. Everything else can follow after stabilization with incident timestamps.",
        signal:
          "A four-part emergency record preserves essential evidence without delaying response.",
      },
      {
        speakerIndex: 3,
        category: "constraints",
        text: "The dissent channel cannot mean waiting for every team. Product can name customer impact quickly, but the incident commander must retain authority to act.",
        signal:
          "Emergency consultation must not blur incident-command authority.",
      },
      {
        speakerIndex: 1,
        category: "actions",
        text: "I’ll add that minimum record to the emergency-change drill and test whether remote warnings remain visible without slowing rollback or confusing command.",
        signal: "Release engineering owns a timed emergency-decision drill.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "explicit authority versus approval ceremony",
        "schedule pressure versus evidence-based release gates",
      ],
      emergingDecision: "Pilot a single evidence-rich release decision record.",
      ownedAction: "Sora will add replica-lag gating and rehearse rollback.",
      unresolvedConcern: "Emergency changes need a different decision pattern.",
    },
  },
  {
    slug: "resident-led-shared-spaces",
    title: "Housing Renewal: Resident-Led Shared Spaces",
    durationMinutes: 4,
    description:
      "A participatory ideation review where maintenance, youth use, older residents, safety, and informal social life challenge a polished courtyard concept.",
    topic: "Resident-led renewal of shared spaces in a housing estate",
    domain: "Community co-design and place-making",
    workshopType: "ideation_review",
    objective:
      "Choose small, reversible shared-space experiments that distribute benefit and decision power across residents before committing the capital budget.",
    phase: "ideate",
    criteria: [
      "Reflects different ages and patterns of use",
      "Supports safety without hostile exclusion",
      "Can be maintained with available resources",
      "Gives residents continuing influence after installation",
    ],
    difficulty: "realistic",
    crossTalkLevel: "frequent",
    participationProfile: "mixed",
    speakers: [
      {
        name: "Dalia",
        role: "resident organiser",
        viewpoint: "distributed decision power and everyday informal use",
        discourseStyle: "warm and politically clear",
        habitualMove: "asks which residents shaped the apparent consensus",
        calibration:
          "I’m Dalia, the resident organiser. I’ll keep everyday informal use and decision power visible, especially which residents shaped what we are calling consensus.",
      },
      {
        name: "Eli",
        role: "landscape designer",
        viewpoint: "spatial coherence, comfort, and reversible interventions",
        discourseStyle: "visual and open to revision",
        habitualMove: "turns a concern into a spatial alternative",
        calibration:
          "I’m Eli, the landscape designer. I’ll connect residents’ concerns to spatial alternatives and distinguish reversible tests from expensive permanent moves.",
      },
      {
        name: "Mrs Chen",
        role: "older residents representative",
        viewpoint: "rest, shade, visibility, and evening confidence",
        discourseStyle: "quiet and specific",
        habitualMove: "introduces a time-of-day consequence others missed",
        calibration:
          "I’m Mrs Chen, representing older residents. I’ll focus on shade, rest, visibility, evening confidence, and how the same place changes throughout the day.",
      },
      {
        name: "Jayden",
        role: "youth council member",
        viewpoint:
          "belonging, active use, and freedom from automatic suspicion",
        discourseStyle: "candid and energetic",
        habitualMove: "challenges rules that label youth presence as disorder",
        calibration:
          "I’m Jayden from the youth council. I’ll challenge designs that treat young people gathering as a problem and bring actual after-school use into the discussion.",
      },
      {
        name: "Pat",
        role: "housing maintenance manager",
        viewpoint: "repair capacity, stewardship, and long-term operating cost",
        discourseStyle: "practical and transparent",
        habitualMove:
          "names the maintenance consequence and offers a smaller trial",
        calibration:
          "I’m Pat from housing maintenance. I’ll make repair capacity and operating costs explicit and suggest trials we can support without promising invisible labour.",
      },
    ],
    dialogue: [
      {
        speakerIndex: 1,
        category: "positions",
        text: "The current concept creates one central garden room with fixed benches, low planting, brighter lighting, and a small play edge facing the community hall.",
        signal:
          "The initial concept concentrates activity in one polished central space.",
      },
      {
        speakerIndex: 3,
        category: "evidence",
        text: "The play edge is for little children. Teenagers currently sit on the wall because it is the only place where eight people can face each other.",
        signal: "The concept omits actual teenage group use.",
      },
      {
        speakerIndex: 2,
        category: "evidence",
        text: "And the central courtyard is hottest at four o’clock. Older residents use the narrow east path then because the building shade reaches it first.",
        signal:
          "Time-of-day shade makes the secondary path more usable than the centre.",
        overlap: "interruption",
      },
      {
        speakerIndex: 1,
        category: "questions",
        text: "So our plan privileges the centre because it photographs well, not because it follows use. Should we distribute smaller settings along the shaded routes?",
        signal:
          "The designer questions centralisation and proposes distributed settings.",
      },
      {
        speakerIndex: 4,
        category: "constraints",
        text: "Distributed furniture is manageable if components are standard. Custom timber seats in five locations will fail differently and consume the whole repair budget.",
        signal: "Distributed space requires standard, repairable components.",
      },
      {
        speakerIndex: 0,
        category: "themes",
        text: "The issue is not one perfect shared space. It is whether different groups can make a place theirs without another group being designed out.",
        signal:
          "Plural belonging replaces the goal of a single ideal shared space.",
      },
      {
        speakerIndex: 3,
        category: "positions",
        text: "Then do not use divided benches in the name of safety. They stop people sleeping, yes, but they also tell us we are allowed only one body at a time.",
        signal:
          "Hostile seating controls undermine youth belonging and flexible use.",
        overlap: "interruption",
      },
      {
        speakerIndex: 2,
        category: "constraints",
        text: "I do want arms on some seats because standing up is difficult. Could we mix seat types instead of making every bench solve the same need?",
        signal:
          "Seat arms support mobility for some residents without requiring universal division.",
      },
      {
        speakerIndex: 1,
        category: "alternatives",
        text: "Yes—movable group seats near the wall, backed seats with arms on the shaded path, and temporary tables where the garden room was proposed.",
        signal:
          "A distributed mix of seating types responds to different needs.",
      },
      {
        speakerIndex: 4,
        category: "questions",
        text: "Who moves and stores the loose pieces? If that becomes unpaid work for Dalia’s group, the flexible concept depends on burnout.",
        signal: "Flexible space can hide ongoing stewardship labour.",
      },
      {
        speakerIndex: 0,
        category: "alternatives",
        text: "Use lockable, lightweight clusters and fund resident stewards for the trial. Stewardship is part of the service, not a volunteer footnote.",
        signal:
          "The trial explicitly funds resident stewardship rather than assuming volunteer labour.",
        overlap: "eager_agreement",
      },
      {
        speakerIndex: 3,
        category: "actions",
        text: "I’ll recruit youth and older residents to log where pieces move, conflicts, and what is unused. We can review evidence together after six weeks.",
        signal:
          "Youth council owns participatory use logging across resident groups.",
      },
      {
        speakerIndex: 1,
        category: "decisions",
        text: "We’ll pause the permanent garden room and run three distributed, repairable seating experiments with mixed support, shade, funded stewardship, and resident-led review.",
        signal:
          "The team chooses reversible distributed experiments over permanent construction.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Please keep evening lighting open. Brighter light may feel safe to some residents, but glare into ground-floor homes has not been discussed with those tenants.",
        signal: "Lighting safety and residential glare remain unresolved.",
      },
      {
        speakerIndex: 4,
        category: "constraints",
        text: "We can trial shielded, lower fittings without new trenches, but someone must inspect them after dark. Daytime checks will miss the actual problem.",
        signal:
          "A lighting trial requires after-dark inspection rather than daytime assumptions.",
      },
      {
        speakerIndex: 3,
        category: "alternatives",
        text: "Let residents carry simple light cards on an evening walk: too dark, comfortable, or glare. That maps different routes without pretending one level fits everyone.",
        signal:
          "Resident-led evening walks can map conflicting lighting needs.",
      },
      {
        speakerIndex: 0,
        category: "actions",
        text: "I’ll recruit ground-floor tenants as well as path users, and we’ll publish the map before choosing any permanent fitting or brightness.",
        signal:
          "Resident organisers own an inclusive lighting evidence process.",
      },
      {
        speakerIndex: 2,
        category: "questions",
        text: "Please test rain and winter darkness too. A comfortable summer walk may tell us little about reflections, puddles, or confidence later in the year.",
        signal:
          "Seasonal and wet-weather lighting performance remains unresolved.",
      },
    ],
    expectedWindowOutcome: {
      tensions: [
        "central visual coherence versus distributed everyday use",
        "flexibility versus hidden stewardship labour",
      ],
      emergingDecision:
        "Run three reversible, distributed seating experiments.",
      ownedAction: "Jayden will organise participatory use logging and review.",
      unresolvedConcern: "Evening lighting and glare need tenant input.",
    },
  },
];

if (BLUEPRINTS.length > PRECONFIGURED_SCENARIO_LIMIT) {
  throw new Error(
    `Preconfigured scenario catalogue exceeds its ${PRECONFIGURED_SCENARIO_LIMIT}-case limit.`,
  );
}

export const PRECONFIGURED_SCENARIOS: PreconfiguredScenario[] =
  BLUEPRINTS.map(buildScenario);

/**
 * Inserts missing catalogue cases, refreshes safe metadata, and applies each
 * source-script revision once. Stable IDs and the stored revision marker make
 * subsequent startups idempotent.
 */
export async function seedPreconfiguredScenarios(
  client: PrismaClient,
): Promise<void> {
  for (const scenario of PRECONFIGURED_SCENARIOS) {
    const existing = await client.scenario.findUnique({
      where: { id: scenario.id },
      select: { expectedWindowOutcomeJson: true },
    });
    const expectedWindowOutcomeJson = JSON.stringify({
      ...scenario.expectedWindowOutcome,
      _catalogRevision: PRECONFIGURED_CATALOG_REVISION,
    });
    if (existing) {
      const storedRevision = readCatalogRevision(
        existing.expectedWindowOutcomeJson,
      );
      const refreshTranscript = storedRevision < PRECONFIGURED_CATALOG_REVISION;
      await client.scenario.update({
        where: { id: scenario.id },
        data: {
          durationMinutes: scenario.durationMinutes,
          budgetJson: JSON.stringify(scenario.budget),
          expectedWindowOutcomeJson,
          ...(refreshTranscript
            ? {
                speakersJson: JSON.stringify(scenario.speakers),
                turnsJson: JSON.stringify(scenario.turns),
                status: "draft",
                realizedDurationMs: null,
                overlapRatioPct: null,
                preflightJson: null,
                approvedAt: null,
              }
            : {}),
        },
      });
      continue;
    }
    await client.scenario.create({
      data: {
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        topic: scenario.topic,
        domain: scenario.domain,
        workshopType: scenario.workshopType,
        objective: scenario.objective,
        phase: scenario.phase,
        criteria: JSON.stringify(scenario.criteria),
        language: scenario.language,
        durationMinutes: scenario.durationMinutes,
        speakerCount: scenario.speakerCount,
        difficulty: scenario.difficulty,
        crossTalkLevel: scenario.crossTalkLevel,
        participationProfile: scenario.participationProfile,
        budgetJson: JSON.stringify(scenario.budget),
        speakersJson: JSON.stringify(scenario.speakers),
        turnsJson: JSON.stringify(scenario.turns),
        expectedWindowOutcomeJson,
        status: scenario.status,
      },
    });
  }
}

function readCatalogRevision(value: string | null): number {
  try {
    const revision = Number(JSON.parse(value || "{}")?._catalogRevision);
    return Number.isInteger(revision) ? revision : 0;
  } catch {
    return 0;
  }
}

export function isPreconfiguredScenarioId(id: string): boolean {
  return id.startsWith(PRECONFIGURED_SCENARIO_PREFIX);
}

function buildScenario(blueprint: ScenarioBlueprint): PreconfiguredScenario {
  const speakers = createDefaultCasting(
    blueprint.speakers.length,
    blueprint.speakers,
  );
  const calibrationTurns: ScenarioTurn[] = blueprint.speakers.map(
    (speaker, index) => ({
      id: `cal-${index + 1}`,
      index,
      speakerIndex: index,
      text: speaker.calibration,
      expectedCategory: "themes",
      expected: {
        substantive: false,
        category: "themes",
        potentialSignal: "voice calibration and perspective introduction",
      },
      isCalibration: true,
      pauseBeforeMs: index === 0 ? 1000 : 850,
      delivery: {
        pace: "natural",
        tone: "calm self-introduction",
        volume: "normal",
        disfluency: "none",
      },
    }),
  );
  const dialogueTurns: ScenarioTurn[] = blueprint.dialogue.map(
    (turn, index) => {
      const id = `turn-${String(index + 1).padStart(2, "0")}`;
      const previousId =
        index > 0 ? `turn-${String(index).padStart(2, "0")}` : undefined;
      const respondsTo =
        index === 0
          ? undefined
          : `turn-${String((turn.respondsTo ?? index - 1) + 1).padStart(2, "0")}`;
      const category = normalizeBlueprintCategory(turn.category);
      const overlap =
        turn.overlap && previousId
          ? {
              withTurnId: previousId,
              startBeforeEndMs: turn.overlap === "backchannel" ? 260 : 520,
              kind: turn.overlap,
              resolution:
                turn.overlap === "backchannel"
                  ? ("backchannel" as const)
                  : turn.overlap === "interruption"
                    ? ("yield" as const)
                    : ("continue" as const),
            }
          : undefined;
      return {
        id,
        index: calibrationTurns.length + index,
        speakerIndex: turn.speakerIndex,
        text: turn.text,
        expectedCategory: category,
        expected: {
          substantive: turn.overlap !== "backchannel",
          category,
          potentialSignal: turn.signal,
          reactsToTurnId: respondsTo,
        },
        pauseBeforeMs: overlap
          ? 0
          : (turn.pauseBeforeMs ?? [280, 420, 190, 610, 340][index % 5]),
        overlap,
        delivery: {
          pace:
            turn.overlap === "interruption" || category === "actions"
              ? "quick"
              : "natural",
          tone:
            category === "questions"
              ? "genuinely curious"
              : category === "decisions"
                ? "tentative and collaborative"
                : "engaged and conversational",
          volume: turn.overlap === "backchannel" ? "soft" : "normal",
          disfluency: turn.overlap === "interruption" ? "light" : "none",
        },
      };
    },
  );
  const turns = normalizeScenarioTurns(
    [...calibrationTurns, ...dialogueTurns],
    speakers.length,
  );
  const durationMinutes = blueprint.durationMinutes;
  return {
    id: `${PRECONFIGURED_SCENARIO_PREFIX}${blueprint.slug}`,
    title: blueprint.title,
    description: blueprint.description,
    topic: blueprint.topic,
    domain: blueprint.domain,
    workshopType: blueprint.workshopType,
    objective: blueprint.objective,
    phase: blueprint.phase,
    criteria: blueprint.criteria,
    language: "en",
    durationMinutes,
    speakerCount: speakers.length,
    difficulty: blueprint.difficulty,
    crossTalkLevel: blueprint.crossTalkLevel,
    participationProfile: blueprint.participationProfile,
    budget: estimateBudget(
      durationMinutes,
      speakers.length,
      blueprint.crossTalkLevel,
    ),
    speakers,
    turns,
    expectedWindowOutcome: blueprint.expectedWindowOutcome,
    status: "draft",
  };
}

function normalizeBlueprintCategory(
  category: BlueprintCategory,
): DiscussionCategory {
  if (category === "constraints" || category === "alternatives") {
    return "positions";
  }
  return category;
}
