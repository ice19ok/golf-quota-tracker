import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const playerId =
      typeof body.playerId === "string"
        ? body.playerId
        : "";

    if (!email || !password || !playerId) {
      return NextResponse.json(
        {
          error:
            "Email, password, and player are required.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 6 characters.",
        },
        { status: 400 }
      );
    }

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const adminSupabase =
      createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    const { data: player, error: playerError } =
      await adminSupabase
        .from("players")
        .select("id, name")
        .eq("id", playerId)
        .single();

    if (playerError || !player) {
      return NextResponse.json(
        { error: "Selected player was not found." },
        { status: 400 }
      );
    }

    const { data: existingProfile } =
      await adminSupabase
        .from("profiles")
        .select("id")
        .eq("player_id", playerId)
        .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        {
          error:
            "This player already has a login.",
        },
        { status: 409 }
      );
    }

    const {
      data: authData,
      error: authError,
    } =
      await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "Could not create user.",
        },
        { status: 400 }
      );
    }

    const { error: insertProfileError } =
      await adminSupabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          role: "user",
          player_id: playerId,
        });

    if (insertProfileError) {
      await adminSupabase.auth.admin.deleteUser(
        authData.user.id
      );

      return NextResponse.json(
        {
          error:
            "User was created but could not be attached to the player.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      player: {
        id: player.id,
        name: player.name,
      },
    });
  } catch (error) {
    console.error(
      "Create user error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}