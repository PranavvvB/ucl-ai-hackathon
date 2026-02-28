import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// MOCK DATA — replace this entire file once /analyze backend is live.
// The real endpoint should accept POST { videoUrl, liftType } and return:
//   { reps: number, rpe: number, advice: string, score: number,
//     pros: string[], corrections: string[] }
// =============================================================================

interface MockLiftData {
  pros: string[];
  corrections: string[];
  advice: string;
}

const MOCK_DATA: Record<string, MockLiftData> = {
  squat: {
    pros: [
      "Excellent depth — hitting well below parallel consistently.",
      "Solid bracing: your core stays tight throughout the descent.",
    ],
    corrections: [
      "Knees caving inward at the bottom — cue 'spread the floor' to fix valgus collapse.",
      "Bar is drifting forward on the ascent — focus on driving hips up first, not chest.",
    ],
    advice:
      "Your squat mechanics are looking solid overall. The depth is there and your brace is holding well through the sticking point. The main area to attack is the valgus collapse you get in the hole — this is usually a combination of weak glute medius and adductors, plus ankle mobility restricting your stance width. Try adding banded clamshells and goblet squats with a pause at depth before your next session.\n\nOn the concentric, the bar is drifting slightly forward which shifts load onto your lower back. Think about pushing the floor away rather than standing up — this cue helps keep your torso angle consistent. Filming from the side at hip height will help you self-monitor this going forward.",
  },
  "bench-press": {
    pros: [
      "Good leg drive — you are maintaining full foot contact and generating power.",
      "Consistent bar path — the bar travels in a slight arc from chest to lockout.",
    ],
    corrections: [
      "Elbows flaring too wide — tuck them ~45 degrees to protect your shoulders.",
      "Losing arch at lockout — maintain your setup tension through the full rep.",
    ],
    advice:
      "Your bench setup is strong — the leg drive is real and transferring force well. The bar path is nearly optimal with that slight J-curve, which tells me your lat engagement is decent. The two things holding back your numbers are elbow flare and tension loss at lockout.\n\nElbow flare at heavier percentages is almost always a lat tightness issue. Before you set up, pull the bar apart and think about bending the bar into a U-shape — this activates your lats and naturally tucks the elbows. At lockout, actively squeeze your glutes and lock your shoulder blades down — the arch should not relax until the bar is back in the rack.",
  },
  deadlift: {
    pros: [
      "Strong hip hinge pattern — the bar stays close to your body throughout.",
      "Head is neutral — you are not hyperextending your neck.",
    ],
    corrections: [
      "Hips shooting up too fast off the floor — think 'push the floor away', not 'pull up'.",
      "Lower back rounding just before lockout — brace harder and finish with glutes.",
    ],
    advice:
      "Your deadlift has a solid foundation — the bar path is nearly vertical and your neck position is textbook. The two breakdown points are off the floor and at lockout, which are the two most common spots and both fixable.\n\nHips rising before the bar breaks the floor means you are transitioning to a stiff-leg pattern early, losing leg drive. Before your next pull, practise the leg press cue: take your starting position and imagine you are pushing the platform away rather than pulling the bar up. The first 2-3 inches should feel like a leg press. For the lockout, your lower back is taking over from your glutes — squeeze hard at the top and think 'hips through'. Adding hip thrusts to your accessory work will reinforce this pattern.",
  },
};

export async function POST(request: NextRequest) {
  const { liftType } = await request.json();

  // Simulate backend processing latency
  await new Promise((r) => setTimeout(r, 2500));

  const mock = MOCK_DATA[liftType] ?? MOCK_DATA["squat"];

  // TODO: Once the real /analyze endpoint is live, proxy or replace this
  //       handler with a call to the external API and return its response.
  return NextResponse.json({
    // -- Fields matching the real /analyze contract --
    reps:   Math.floor(Math.random() * 4) + 3,          // 3-6 reps (dummy)
    rpe:    parseFloat((Math.random() * 3 + 6.5).toFixed(1)), // 6.5-9.5 (dummy)
    advice: mock.advice,

    // -- Legacy fields (also expected from real endpoint eventually) --
    score:       Math.floor(Math.random() * 25) + 70,   // 70-94 (dummy)
    pros:        mock.pros,
    corrections: mock.corrections,
    liftType,
  });
}