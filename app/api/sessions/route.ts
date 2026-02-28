import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import pool from "@/lib/db";

// POST /api/sessions  save a lift session
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { liftType, videoUrl, score, pros, corrections } = await req.json();

  await pool.execute(
    `INSERT INTO lift_sessions (user_id, lift_type, video_url, score, pros, corrections)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, liftType, videoUrl, score, JSON.stringify(pros), JSON.stringify(corrections)]
  );

  return NextResponse.json({ ok: true });
}

// GET /api/sessions  fetch sessions for the logged-in user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows] = await pool.execute(
    `SELECT id, lift_type, video_url, score, pros, corrections, created_at
     FROM lift_sessions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  ) as [Array<{id: string; lift_type: string; video_url: string; score: number; pros: string; corrections: string; created_at: string}>, unknown];

  const sessions = rows.map((r) => ({
    ...r,
    pros: typeof r.pros === "string" ? JSON.parse(r.pros) : r.pros,
    corrections: typeof r.corrections === "string" ? JSON.parse(r.corrections) : r.corrections,
  }));

  return NextResponse.json(sessions);
}
