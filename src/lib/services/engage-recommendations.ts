import "server-only";

export const ENGAGE_CATEGORIES = [
  "BEFORE_CLASS",
  "AFTER_CLASS",
  "CHALLENGES",
  "TIPS",
  "POLLS",
  "LOGISTICS",
] as const;

export type EngageCategory = (typeof ENGAGE_CATEGORIES)[number];
export type EngageSource = "EVERGREEN" | "CONTEXTUAL" | "PERSISTED_REMINDER";
export type EngageCta =
  "Draft Reminder" | "Create Class Note" | "Draft Challenge" | "Draft Tip" | "Create Poll";

export type EngageRecommendation = {
  id: string;
  source: EngageSource;
  category: EngageCategory;
  eyebrow: string;
  title: string;
  context: string;
  suggestedNote: string;
  cta: EngageCta;
  eventId?: string;
  organizationId?: string;
  relevantAt?: string;
};

export type EngageRecommendationDefinition = Omit<
  EngageRecommendation,
  "source" | "eventId" | "organizationId" | "relevantAt"
> & {
  source: "EVERGREEN";
};

/** Product-owned evergreen Engage content. Keep copy here, not in page components. */
export const ENGAGE_RECOMMENDATION_LIBRARY = [
  {
    id: "before-class-arrival-window",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Make Arrival Easy",
    context: "Helps people know when and how to arrive without adding pressure.",
    suggestedNote:
      "We’ll be ready for arrivals from about 10 minutes before class. Come in when you can, say hello, and give yourself a moment to settle.",
    cta: "Draft Reminder",
  },
  {
    id: "before-class-first-timer-welcome",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Welcome First-Timers",
    context: "Gives new people a clear, warm invitation into the group.",
    suggestedNote:
      "If tonight is your first class with us, welcome. You don’t need to know everything before you arrive—we’ll explain the flow and make room for questions.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-class-theme",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Name the Theme",
    context: "Creates curiosity and a shared point of focus before the session begins.",
    suggestedNote:
      "Today’s theme is staying relaxed while we work: clear eyes, easy breathing, and one useful adjustment at a time.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-personal-intention",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Choose Your Intention",
    context: "Invites people to define a helpful focus that is not performance-based.",
    suggestedNote:
      "Before we meet, choose one intention for today: curiosity, steady breathing, good technique, or simply being present. You can share yours here if you’d like.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-equipment-check",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Do a Quick Kit Check",
    context: "Prevents avoidable friction around gloves, wraps, water, and personal equipment.",
    suggestedNote:
      "Quick kit check for class: wraps or gloves if you use them, water, and comfortable clothes. If you’re missing something, message me and we’ll find a simple solution.",
    cta: "Draft Reminder",
  },
  {
    id: "before-class-partner-culture",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Set the Partner Tone",
    context: "Makes mutual care and communication part of the class expectation.",
    suggestedNote:
      "When we work with a partner today, please communicate clearly, adjust when needed, and help each other learn. Good rounds leave both people feeling supported.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-question-box",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Bring One Question",
    context: "Turns uncertainty into a useful learning prompt for the coach and group.",
    suggestedNote:
      "Is there a boxing, strength, or movement question you’ve been carrying? Drop it here, and I’ll work it into today’s coaching where I can.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-breathing-reset",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Arrive With One Breath",
    context: "Offers a small transition ritual for people coming from a busy day.",
    suggestedNote:
      "Before you head in, take one slow breath and let your shoulders drop. You don’t have to arrive perfectly ready—just arrive as you are.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-movement-prep",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Notice Your Starting Point",
    context: "Encourages honest self-awareness so people can choose useful adjustments.",
    suggestedNote:
      "On the way to class, notice how your body feels today—energized, stiff, distracted, or somewhere in between. Bring that information with you so we can train thoughtfully.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-pacing-permission",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Choose Your Pace",
    context: "Sets a sustainable expectation and gives permission to modify.",
    suggestedNote:
      "Today you’re welcome to choose the version that fits you. Ask for a modification, take a breath, or reset whenever that helps you practice well.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-community-roll-call",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Say Hello Before We Start",
    context: "Creates low-pressure conversation and helps people recognize one another.",
    suggestedNote:
      "Before class, say hello in the chat and tell us one word for how you’re arriving today. A one-word answer is perfect.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-skill-preview",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Preview the Skill",
    context: "Gives people a simple mental picture of what they will practice.",
    suggestedNote:
      "We’ll spend some time on returning to stance after a combination. Nothing fancy—just a clear reset that makes the next movement easier.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-weather-plan",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Plan for the Journey",
    context: "Makes arrival safer and calmer when weather may affect travel.",
    suggestedNote:
      "The weather may change the journey today. Please give yourself extra travel time and message the group if you need the arrival plan or directions.",
    cta: "Draft Reminder",
  },
  {
    id: "before-class-access-needs",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Share What Helps",
    context: "Makes it easier for people to request practical support before class.",
    suggestedNote:
      "If there’s anything that would help you take part comfortably today—space, equipment, pacing, or a quick explanation—send me a note before we start.",
    cta: "Create Class Note",
  },
  {
    id: "before-class-community-introduction",
    source: "EVERGREEN",
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Help Us Learn Names",
    context: "Gives a new or changing group an easy way to build familiarity.",
    suggestedNote:
      "We have a few new faces joining us. If you’re comfortable, share your name and one thing you enjoy practicing. We’ll make introductions easier when we meet.",
    cta: "Create Class Note",
  },
  {
    id: "after-class-one-thing-noticed",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Name One Thing You Noticed",
    context: "Prompts reflection without asking people to judge their performance.",
    suggestedNote:
      "What’s one thing you noticed in today’s practice—a movement, a thought, a question, or a moment that felt different?",
    cta: "Create Class Note",
  },
  {
    id: "after-class-technique-takeaway",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Share the Takeaway",
    context: "Helps the group consolidate one learnable idea from class.",
    suggestedNote:
      "Today’s small takeaway: return to a balanced stance before rushing into the next action. What coaching point are you taking with you?",
    cta: "Create Class Note",
  },
  {
    id: "after-class-appreciation",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Appreciate the Room",
    context: "Reinforces belonging by noticing the shared effort and atmosphere.",
    suggestedNote:
      "Thank you for the way you brought attention and care to the room today. What was one part of the shared practice you appreciated?",
    cta: "Create Class Note",
  },
  {
    id: "after-class-partner-thanks",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Thank a Training Partner",
    context: "Encourages mutual recognition without ranking people.",
    suggestedNote:
      "If someone helped you learn, reset, laugh, or stay present today, give them a quick thank-you here.",
    cta: "Create Class Note",
  },
  {
    id: "after-class-recovery-check-in",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Check In With Recovery",
    context: "Normalizes noticing recovery needs immediately after training.",
    suggestedNote:
      "How are you feeling after class—steady, tired, energized, or in need of a gentler evening? Share what kind of recovery would help you most.",
    cta: "Create Class Note",
  },
  {
    id: "after-class-question-carry-forward",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Keep the Question",
    context: "Turns an unanswered or emerging question into a bridge to future learning.",
    suggestedNote:
      "What question are you leaving with today? It can be about technique, pacing, or anything you want to understand better.",
    cta: "Create Class Note",
  },
  {
    id: "after-class-small-win",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Notice a Small Win",
    context: "Helps people recognize progress in attention, confidence, or consistency.",
    suggestedNote:
      "A small win counts today. What did you make a little clearer, calmer, or more comfortable through practice?",
    cta: "Create Class Note",
  },
  {
    id: "after-class-coach-observation",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Share a Coaching Note",
    context: "Extends one useful observation beyond the class without overloading the group.",
    suggestedNote:
      "One thing I noticed today: people became more patient with the reset between movements. That patience is useful practice in and out of the room.",
    cta: "Create Class Note",
  },
  {
    id: "after-class-music-memory",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Keep the Energy in Words",
    context: "Uses a shared sensory detail to invite light conversation.",
    suggestedNote:
      "Which song or moment helped the room feel most like our group today? I’m curious what people noticed.",
    cta: "Create Class Note",
  },
  {
    id: "after-class-hydration-meal-reminder",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Make the Next Hour Helpful",
    context: "Offers practical, non-prescriptive recovery support.",
    suggestedNote:
      "For the next hour, make things easy on yourself: drink some water, have something nourishing if you need it, and give your body a little time to come down.",
    cta: "Draft Tip",
  },
  {
    id: "after-class-bring-it-next-time",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Bring One Idea Forward",
    context: "Creates a clear bridge from today’s experience to the next session.",
    suggestedNote:
      "What would you like to bring into our next class: a question, a technique cue, a calmer breath, or a little more time with today’s skill?",
    cta: "Create Class Note",
  },
  {
    id: "after-class-community-photo-prompt",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Share the Moment",
    context: "Invites an optional, inclusive memory of the group experience.",
    suggestedNote:
      "If you captured a photo of the room or your post-class moment, share it here if you’d like. No polished pictures needed—just a glimpse of the community.",
    cta: "Create Class Note",
  },
  {
    id: "after-class-rest-is-training",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Let Rest Do Its Work",
    context: "Helps people understand rest as part of sustainable practice.",
    suggestedNote:
      "Rest is part of training too. If tonight is a quieter evening, let that be a useful choice rather than something to earn.",
    cta: "Draft Tip",
  },
  {
    id: "after-class-welcome-back",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Welcome the Return",
    context: "Makes returning after time away feel easy and non-judgmental.",
    suggestedNote:
      "It was good to have returning faces in the room today. You never need a perfect explanation for time away—there’s always a place to pick things back up.",
    cta: "Create Class Note",
  },
  {
    id: "after-class-open-thread",
    source: "EVERGREEN",
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Leave the Thread Open",
    context: "Gives the group a simple reason to keep talking after the session.",
    suggestedNote:
      "I’ll leave this thread open: what would you like us to revisit, explain, or try differently next time?",
    cta: "Create Class Note",
  },
  {
    id: "challenge-seven-day-consistency",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Make Seven Days Count",
    context: "Invites a flexible week of practice without requiring attendance or app tracking.",
    suggestedNote:
      "For the next seven days, choose one small way to stay connected to your practice: attend, shadowbox gently, stretch, read, or simply notice your breathing. Reply with what you choose.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-five-minute-mobility",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Take Five for Mobility",
    context: "Makes mobility approachable and useful on busy days.",
    suggestedNote:
      "This week’s five-minute challenge: give your shoulders, hips, or ankles a little attention once a day. No score—just notice whether a few minutes changes how you feel.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-stance-reset",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Practice the Reset",
    context: "Builds technique through a small repeatable skill.",
    suggestedNote:
      "Try three calm stance resets this week. Step, breathe, find your balance, and notice what helps you feel ready for the next movement.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-breath-between-rounds",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Own the Pause",
    context: "Develops recovery awareness through breathing between efforts.",
    suggestedNote:
      "This week, practice one slow breath whenever you finish a round or effort. Let the pause teach you something about how you recover.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-questions-week",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Ask One Better Question",
    context: "Encourages curiosity and active learning.",
    suggestedNote:
      "Your challenge is to ask one question this week—during class, in the chat, or privately. Questions are part of becoming more skilled.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-kind-coaching-cue",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Offer One Useful Cue",
    context: "Builds peer learning while keeping coaching respectful and optional.",
    suggestedNote:
      "If a partner welcomes feedback this week, offer one clear, kind cue and then give them room to try it. Share what made the exchange useful.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-recovery-menu",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Build Your Recovery Menu",
    context: "Helps people discover personal recovery practices rather than follow one rigid rule.",
    suggestedNote:
      "Choose two recovery tools to try this week—an earlier night, an easy walk, mobility, a quiet meal, or time away from screens. Notice what genuinely helps.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-non-dominant-side",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Explore the Other Side",
    context: "Adds playful technique variety without turning practice into a contest.",
    suggestedNote:
      "If it feels appropriate in class, spend a few gentle minutes exploring your non-dominant side. Stay curious and keep the movement simple.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-arrive-early-once",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Give Yourself Ten Minutes",
    context: "Encourages preparation and a calmer class transition.",
    suggestedNote:
      "Try arriving about ten minutes early once this week. Use the time to greet someone, ask a question, or settle your breathing before we begin.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-celebrate-someone",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Encourage Someone Specifically",
    context: "Makes recognition concrete and community-centered.",
    suggestedNote:
      "This week, encourage someone with a specific observation: ‘I noticed your patience,’ ‘That reset looked clear,’ or ‘Thanks for making space.’ Share the kindness if you’d like.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-practice-the-basics",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Return to One Basic",
    context: "Reinforces foundations without implying that basics are lesser work.",
    suggestedNote:
      "Choose one basic from class—stance, guard, bracing, footwork, or breathing—and give it a few attentive minutes this week.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-device-free-transition",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Protect the Transition",
    context: "Creates a short mindful boundary around training.",
    suggestedNote:
      "Before or after one session this week, give yourself five device-free minutes. Notice the room, your breath, and the shift into or out of practice.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-share-a-resource",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Teach the Group Something",
    context: "Invites contribution and shared learning from every experience level.",
    suggestedNote:
      "Share one resource that has helped you learn—an article, a drill, a cue, a song, or a question. Keep it welcoming and explain why it helped.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-choose-your-version",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Practice the Right Version",
    context: "Makes self-adjustment an active skill rather than a fallback.",
    suggestedNote:
      "This week, notice one moment when you choose a version that fits your body and energy. That decision is part of good practice—tell us what helped you choose.",
    cta: "Draft Challenge",
  },
  {
    id: "challenge-community-check-in",
    source: "EVERGREEN",
    category: "CHALLENGES",
    eyebrow: "Challenge",
    title: "Bring One Honest Check-In",
    context: "Builds conversation through low-stakes participation.",
    suggestedNote:
      "Once this week, check in with the group using three words: how you arrived, what you practiced, and what you need next.",
    cta: "Draft Challenge",
  },
  {
    id: "tips-boxing-relaxed-hands",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Keep the Hands Relaxed",
    context: "Gives boxing participants a practical cue for reducing unnecessary tension.",
    suggestedNote:
      "Boxing tip: keep the hands relaxed until the moment they need to work. A softer reset can make your next movement feel quicker and easier.",
    cta: "Draft Tip",
  },
  {
    id: "tips-boxing-eyes-up",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Let the Eyes Stay Wide",
    context: "Helps people read movement and stay connected to their surroundings.",
    suggestedNote:
      "Try keeping your eyes soft and wide instead of staring at one point. You may notice more of the movement, the space, and your partner’s cues.",
    cta: "Draft Tip",
  },
  {
    id: "tips-boxing-return-to-stance",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Come Home to Stance",
    context: "Reinforces a dependable technical foundation.",
    suggestedNote:
      "After a combination, think ‘return home’: feet under you, balance available, breath back. The reset is part of the combination.",
    cta: "Draft Tip",
  },
  {
    id: "tips-strength-quality-reps",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Let Quality Lead",
    context: "Frames strength work around control and learning, not maximum output.",
    suggestedNote:
      "In strength work, a clean and controlled repetition teaches more than a rushed one. Leave enough attention for the next rep.",
    cta: "Draft Tip",
  },
  {
    id: "tips-strength-brace-breathe",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Brace Without Holding Everything",
    context: "Offers a beginner-friendly strength cue.",
    suggestedNote:
      "Try pairing effort with a steady breath: prepare, move with control, and exhale through the part that requires work. Bracing should support you, not make you rigid.",
    cta: "Draft Tip",
  },
  {
    id: "tips-mobility-small-range",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Start With the Range You Have",
    context: "Makes mobility more accessible and less forceful.",
    suggestedNote:
      "Mobility doesn’t need to begin at the deepest range. Start where you can breathe easily, explore slowly, and let the range grow through attention.",
    cta: "Draft Tip",
  },
  {
    id: "tips-mobility-consistency",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Small Mobility Beats Rare Heroics",
    context: "Encourages sustainable habit-building.",
    suggestedNote:
      "A few comfortable minutes of mobility repeated often can be more useful than one intense session you dread. Choose a small version you’ll actually return to.",
    cta: "Draft Tip",
  },
  {
    id: "tips-recovery-sleep-cue",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Make Sleep Easier Tonight",
    context: "Connects recovery to a simple evening behavior.",
    suggestedNote:
      "If recovery is the goal tonight, try making the last part of your evening quieter: dim the lights, put the phone down for a little while, and let sleep arrive.",
    cta: "Draft Tip",
  },
  {
    id: "tips-recovery-soreness-language",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Listen Before You Push",
    context: "Helps people distinguish curiosity from pressure when they feel sore.",
    suggestedNote:
      "Soreness is information, not a challenge to defeat. Move gently, adjust the plan, and ask for guidance if something feels sharp, unusual, or unclear.",
    cta: "Draft Tip",
  },
  {
    id: "tips-preparation-water-and-layer",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Pack for the Room",
    context: "Makes preparation concrete for changing conditions and venues.",
    suggestedNote:
      "A useful preparation habit: bring water and one light layer you can add or remove. Comfortable temperature makes it easier to pay attention to practice.",
    cta: "Draft Tip",
  },
  {
    id: "tips-beginner-ask-for-a-demo",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Ask for the First Version",
    context: "Gives beginners a clear way to request help.",
    suggestedNote:
      "If a movement is new, ask for the first version and one thing to feel for. You never need to pretend you understood before you do.",
    cta: "Draft Tip",
  },
  {
    id: "tips-beginner-modification-is-skill",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "A Modification Is Information",
    context: "Reframes adapting movement as skilled participation.",
    suggestedNote:
      "Choosing a modification is a way of listening and learning. Tell your coach what you’re noticing, and we can find a version that keeps the practice useful.",
    cta: "Draft Tip",
  },
  {
    id: "tips-confidence-practice-out-loud",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Name the Cue Out Loud",
    context: "Builds confidence through simple verbal learning.",
    suggestedNote:
      "When a cue helps, quietly say it to yourself: ‘breathe,’ ‘soft shoulders,’ or ‘find the floor.’ Clear words can make a new skill easier to repeat.",
    cta: "Draft Tip",
  },
  {
    id: "tips-habit-anchor-next-action",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Attach Practice to a Routine",
    context: "Provides a practical habit-building method.",
    suggestedNote:
      "To make a practice easier to remember, attach it to something already in your day—after brushing your teeth, before lunch, or when you change clothes.",
    cta: "Draft Tip",
  },
  {
    id: "tips-partner-communication",
    source: "EVERGREEN",
    category: "TIPS",
    eyebrow: "Tip",
    title: "Use Clear Partner Language",
    context: "Supports safety, consent, and learning in paired work.",
    suggestedNote:
      "Simple partner language helps: ‘lighter,’ ‘slower,’ ‘one more explanation,’ or ‘I’m good here.’ Clear communication makes practice better for both people.",
    cta: "Draft Tip",
  },
  {
    id: "poll-class-time-preference",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Find the Useful Time",
    context: "Helps the coach understand when the Group can participate.",
    suggestedNote:
      "Which class time would make it easiest for you to join regularly? Choose the closest fit, and add another option in the chat if we missed it.",
    cta: "Create Poll",
  },
  {
    id: "poll-weekday-weekend",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Weekday or Weekend?",
    context: "Quickly surfaces broad schedule preference before detailed planning.",
    suggestedNote:
      "For a future class, which would you prefer: a weekday session, a weekend session, or either works?",
    cta: "Create Poll",
  },
  {
    id: "poll-class-theme",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Choose the Next Theme",
    context: "Lets the group shape the learning focus.",
    suggestedNote:
      "What should we explore next: footwork, combinations, strength foundations, mobility, recovery, or something you’d add?",
    cta: "Create Poll",
  },
  {
    id: "poll-skill-confidence",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "What Would You Like More Help With?",
    context: "Identifies useful coaching topics without labeling ability.",
    suggestedNote:
      "Which area would you like more help with right now: stance, breathing, defense, combinations, partner work, or something else?",
    cta: "Create Poll",
  },
  {
    id: "poll-class-format",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Choose the Format",
    context: "Helps balance different ways people like to learn and participate.",
    suggestedNote:
      "Which format sounds most useful for an upcoming class: technique lab, partner rounds, stations, guided conditioning, or a mixed session?",
    cta: "Create Poll",
  },
  {
    id: "poll-learning-style",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "How Should We Learn It?",
    context: "Invites people to share the teaching format that helps them most.",
    suggestedNote:
      "When we introduce a new skill, what helps you most: a demo, a short explanation, repeated practice, partner feedback, or time for questions?",
    cta: "Create Poll",
  },
  {
    id: "poll-music-mood",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Set the Room’s Mood",
    context: "Uses music as a light, appropriate way to involve the Group.",
    suggestedNote:
      "What should the next session’s music feel like: steady, upbeat, focused, familiar, or a blend? Keep song requests clean and class-friendly.",
    cta: "Create Poll",
  },
  {
    id: "poll-recovery-topic",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Pick a Recovery Conversation",
    context: "Helps the coach offer relevant education after training.",
    suggestedNote:
      "What recovery topic would be most useful to talk through: sleep, mobility, soreness, rest days, hydration, or easing back after time away?",
    cta: "Create Poll",
  },
  {
    id: "poll-beginner-support",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Make the First Class Easier",
    context: "Surfaces practical ways to improve newcomer experience.",
    suggestedNote:
      "What would help a first class feel easier: a short pre-class guide, equipment explanation, slower demo, buddy welcome, or extra questions time?",
    cta: "Create Poll",
  },
  {
    id: "poll-community-gathering",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Choose a Community Moment",
    context: "Gives the Group a say in a future social or learning gathering.",
    suggestedNote:
      "What kind of community moment would you enjoy: an open practice, technique Q&A, casual coffee, recovery session, or a small Event?",
    cta: "Create Poll",
  },
  {
    id: "poll-event-interest",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "What Event Sounds Useful?",
    context: "Tests interest in future Events before planning them.",
    suggestedNote:
      "If we add a future Event, what would you be most interested in: a workshop, guest coach, friendly practice, outdoor session, or community get-together?",
    cta: "Create Poll",
  },
  {
    id: "poll-location-preference",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Find the Right Setting",
    context: "Helps plan Venue choices around access and comfort.",
    suggestedNote:
      "For a future session, which setting would work well for you: our usual Venue, an outdoor space, a larger studio, or a different neighborhood?",
    cta: "Create Poll",
  },
  {
    id: "poll-class-length",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Choose the Class Length",
    context: "Supports practical scheduling and energy management.",
    suggestedNote:
      "Which class length feels most useful for this format: 45 minutes, 60 minutes, 75 minutes, or it depends on the topic?",
    cta: "Create Poll",
  },
  {
    id: "poll-what-to-practice",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "Pick a Practice Thread",
    context: "Turns group interest into a concrete next-session focus.",
    suggestedNote:
      "Which thread should we keep practicing next: clean basics, combinations, movement, partner timing, strength, or recovery?",
    cta: "Create Poll",
  },
  {
    id: "poll-support-between-classes",
    source: "EVERGREEN",
    category: "POLLS",
    eyebrow: "Poll",
    title: "What Helps Between Classes?",
    context: "Learns which forms of coach support feel welcome and useful.",
    suggestedNote:
      "Between classes, what would you like more of in this Group: short tips, practice ideas, event updates, questions, or recovery reminders?",
    cta: "Create Poll",
  },
  {
    id: "logistics-venue-address",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Put the Venue in One Place",
    context: "Makes arrival information easy to retrieve from the chat.",
    suggestedNote:
      "For reference, our next class is at [Venue name], [address]. Save this message so the location is easy to find when you’re on the way.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-parking-and-transit",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Share the Arrival Options",
    context: "Reduces uncertainty around parking, transit, and walking routes.",
    suggestedNote:
      "Arrival note: [parking/transit detail]. If you’re coming by another route, send a message and I’ll help you find the simplest way in.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-entrance-instructions",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Show the Way In",
    context: "Prevents first-arrival friction at a busy or unfamiliar Venue.",
    suggestedNote:
      "Use the [entrance/elevator/stair] at [location]. I’ll be near [landmark] before class if you need help finding the room.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-arrival-and-start-time",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Confirm the Timing",
    context: "Keeps the practical schedule visible without pressuring late arrivals.",
    suggestedNote:
      "Quick timing check: doors/arrival from [time], class begins at [time], and we’ll finish around [time]. Come safely; message me if your arrival changes.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-what-venue-provides",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Clarify What’s There",
    context: "Helps people avoid bringing equipment the Venue already supplies.",
    suggestedNote:
      "The Venue provides [equipment]. Please bring [personal items], and message me if you’re unsure about anything.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-equipment-sharing",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Plan Shared Equipment",
    context: "Sets expectations when equipment is limited or shared.",
    suggestedNote:
      "We’ll be sharing [equipment] today. If you have your own, bring it; otherwise we’ll organize the room so everyone has a useful option.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-capacity-update",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Share the Room Update",
    context: "Makes capacity changes clear while keeping the tone welcoming.",
    suggestedNote:
      "A quick room update: this class is currently [open/nearly full/full]. If you’re planning to join, please check your booking and message me with any question.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-waitlist-expectation",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Explain the Next Step",
    context: "Helps people understand what to do when a class has limited space.",
    suggestedNote:
      "This class is at capacity right now. If you’d like a place, add yourself through the available waitlist/booking option and I’ll share any confirmed changes here.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-weather-adjustment",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Adjust for the Weather",
    context: "Keeps people informed when conditions affect travel or the session plan.",
    suggestedNote:
      "Because of [weather condition], please plan extra travel time and bring [layer/shoes/water]. I’ll post here if the class plan or Venue needs to change.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-new-class-announcement",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Introduce the New Class",
    context: "Gives a new class a clear, human introduction before promotion or attendance.",
    suggestedNote:
      "We’re opening a new [class name] at [time] in [Venue]. It will focus on [plain-language focus], and all experience levels are welcome to ask questions before joining.",
    cta: "Create Class Note",
  },
  {
    id: "logistics-schedule-change",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Make the Change Clear",
    context: "Prevents schedule changes from being buried or misunderstood.",
    suggestedNote:
      "Schedule update: [class/Event] will now be [new day/time] at [Venue]. Please check whether the new timing works for you and message me with any question.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-event-location-change",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Confirm the New Setting",
    context: "Makes a Venue change explicit and easy to act on.",
    suggestedNote:
      "For [Event], we’ll meet at [new Venue/address] instead of [old Venue]. The start time is [time]. Please reply if you need directions or access details.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-cancellation-update",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Communicate the Cancellation",
    context: "Gives people a direct, respectful update when an Event cannot proceed.",
    suggestedNote:
      "Today’s [class/Event] is cancelled because of [brief reason]. I’m sorry for the change. I’ll share the next available option as soon as it’s confirmed.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-accessibility-arrival",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Share Access Details",
    context: "Helps people plan a comfortable arrival and request support early.",
    suggestedNote:
      "Access note for [Venue]: [entrance, lift, seating, or other detail]. If another arrangement would help you take part, message me before class and we’ll plan it together.",
    cta: "Draft Reminder",
  },
  {
    id: "logistics-holiday-schedule",
    source: "EVERGREEN",
    category: "LOGISTICS",
    eyebrow: "Logistics",
    title: "Plan Around the Calendar",
    context: "Gives the Group useful notice when a holiday changes the normal rhythm.",
    suggestedNote:
      "The holiday calendar changes our usual schedule: [details]. Please check the next class date and tell me if a different option would help.",
    cta: "Draft Reminder",
  },
] as const satisfies readonly EngageRecommendationDefinition[];

const VALID_CTA_BY_CATEGORY: Record<EngageCategory, readonly EngageCta[]> = {
  BEFORE_CLASS: ["Draft Reminder", "Create Class Note"],
  AFTER_CLASS: ["Create Class Note", "Draft Tip"],
  CHALLENGES: ["Draft Challenge"],
  TIPS: ["Draft Tip"],
  POLLS: ["Create Poll"],
  LOGISTICS: ["Draft Reminder", "Create Class Note"],
};

/**
 * Runtime guard for Product-owned content. This intentionally checks structure
 * and contract values, not editorial similarity or meaning.
 */
export function validateEngageRecommendationLibrary(library: readonly unknown[]): void {
  const errors: string[] = [];
  const ids = new Set<string>();
  const titles = new Set<string>();
  const copies = new Set<string>();

  for (const [index, candidate] of library.entries()) {
    const item = candidate as Record<string, unknown>;
    const label = `item ${index}`;
    const requiredStrings = ["id", "eyebrow", "title", "context", "suggestedNote", "cta"];
    for (const field of requiredStrings) {
      if (typeof item[field] !== "string" || item[field].trim() === "") {
        errors.push(`${label} has an empty or malformed ${field}`);
      }
    }
    if (item.source !== "EVERGREEN") errors.push(`${label} must use source EVERGREEN`);

    const id = typeof item.id === "string" ? item.id.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const copy = [item.title, item.context, item.suggestedNote]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .join("\u0000");
    if (id && ids.has(id)) errors.push(`duplicate recommendation id: ${id}`);
    if (id) ids.add(id);
    if (title && titles.has(title)) errors.push(`duplicate recommendation title: ${title}`);
    if (title) titles.add(title);
    if (copy !== "\u0000\u0000") {
      if (copies.has(copy)) errors.push(`duplicate recommendation copy: ${title}`);
      copies.add(copy);
    }

    if (!ENGAGE_CATEGORIES.includes(item.category as EngageCategory)) {
      errors.push(`${label} has an invalid category`);
    } else if (
      !VALID_CTA_BY_CATEGORY[item.category as EngageCategory].includes(item.cta as EngageCta)
    ) {
      errors.push(`${label} has an invalid CTA for ${item.category}`);
    }
  }

  for (const category of ENGAGE_CATEGORIES) {
    if (!library.some((candidate) => (candidate as { category?: unknown }).category === category)) {
      errors.push(`missing recommendation category: ${category}`);
    }
  }
  if (errors.length)
    throw new Error(`Invalid Engage recommendation library:\n- ${errors.join("\n- ")}`);
}

validateEngageRecommendationLibrary(ENGAGE_RECOMMENDATION_LIBRARY);

export type EngageRecommendationPeriod = string;

export type EngageContextSignal =
  | "NEW_CLASS"
  | "NEW_VENUE"
  | "UPCOMING_NEWCOMERS"
  | "FULL_EVENT"
  | "COMPLETED_EVENT"
  | "SCHEDULE_DIFFERENCE";

/** Product-owned copy for contextual Engage moments. */
export const ENGAGE_CONTEXT_COPY: Record<
  EngageContextSignal,
  {
    category: EngageCategory;
    eyebrow: string;
    title: string;
    context: string;
    suggestedNote: string;
    cta: EngageCta;
  }
> = {
  NEW_CLASS: {
    category: "LOGISTICS",
    eyebrow: "New class",
    title: "Make the New Class Easy to Enter",
    context: "A newly published class is a good moment to make the practical details feel clear.",
    suggestedNote:
      "A new class is on the calendar. Share anything helpful to know before people arrive.",
    cta: "Create Class Note",
  },
  NEW_VENUE: {
    category: "LOGISTICS",
    eyebrow: "First gathering",
    title: "Welcome to This Location",
    context:
      "The first future published gathering at this location is a chance to help everyone feel oriented.",
    suggestedNote:
      "We are gathering at this location for the first time. Share the arrival details that will help everyone feel at ease.",
    cta: "Draft Reminder",
  },
  UPCOMING_NEWCOMERS: {
    category: "BEFORE_CLASS",
    eyebrow: "Before class",
    title: "Welcome a Few New Faces",
    context: "Several people are joining this upcoming class for the first time.",
    suggestedNote:
      "A few new people are joining us soon. Let’s make the room welcoming and easy to enter.",
    cta: "Create Class Note",
  },
  FULL_EVENT: {
    category: "LOGISTICS",
    eyebrow: "Worth noticing",
    title: "A Full Room Is Worth Acknowledging",
    context: "An upcoming class has reached capacity.",
    suggestedNote:
      "The room is full for this class. Thank everyone for making space for the shared practice.",
    cta: "Create Class Note",
  },
  COMPLETED_EVENT: {
    category: "AFTER_CLASS",
    eyebrow: "After class",
    title: "Keep the Reflection Going",
    context: "The most recent completed class is a natural moment to invite reflection.",
    suggestedNote:
      "Thank you for being part of today’s class. What stayed with you from the practice?",
    cta: "Create Class Note",
  },
  SCHEDULE_DIFFERENCE: {
    category: "POLLS",
    eyebrow: "Planning",
    title: "Ask What Schedule Works Best",
    context: "This series currently has more than one active day or time pattern.",
    suggestedNote:
      "We are planning upcoming class times. Which day and time would be most useful for you?",
    cta: "Create Poll",
  },
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function isoWeekKey(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getEngageRecommendationPeriod(now = new Date()): EngageRecommendationPeriod {
  return isoWeekKey(now);
}

export function selectEngageRecommendations({
  period = getEngageRecommendationPeriod(),
  categories = ENGAGE_CATEGORIES,
  library = ENGAGE_RECOMMENDATION_LIBRARY,
}: {
  period?: EngageRecommendationPeriod;
  categories?: readonly EngageCategory[];
  library?: readonly EngageRecommendationDefinition[];
} = {}): EngageRecommendation[] {
  return categories.map((category) => {
    const candidates = library.filter((item) => item.category === category);
    if (!candidates.length) throw new Error(`No Engage recommendation exists for ${category}.`);
    const selected = candidates[hash(`${period}:${category}`) % candidates.length];
    return { ...selected };
  });
}
