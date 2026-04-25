# Vocito Studio — Brief B3.1: Remotion Render (Echte MP4)

> Sub-brief van B3. Vervangt de FFmpeg stub door echte Remotion render via Chromium op Railway. Eindresultaat: echte MP4 met blob, copy, animations, music, VO en SFX correct gemixed.

## Context

B3 werd gerapporteerd als "complete" maar de output MP4 is een audio + bare text stub via FFmpeg. Geen blob, geen animaties, geen Vocito visual identity. De HTML preview op de plan pagina toont wel de juiste visuals via React state animatie, maar die is niet exporteerbaar als shareable video file.

B3.1 fixt dit door Remotion volledig te implementeren. Van scene plan naar echte 1080p MP4 met alle visual elements.

## Architectuur beslissingen LOCKED

1. **Render engine: Remotion v4** via `npx remotion render` CLI
2. **Runtime: Railway Docker container met Chromium** (niet AWS Lambda)
3. **HTML preview WEG** — verwijder de fake video player uit plan-review-content.tsx, vervang met "rendering in progress" status indicator + final MP4 player wanneer ready
4. **Single MP4 output**, geen multi-variant
5. **Auto-trigger via render poll loop**, geen handmatige knop
6. **Codec: H.264, CRF 18** (hoge kwaliteit, ~50-150MB voor 33sec @ 1080p)
7. **Frames: 990 @ 30fps = 33 seconden** (LOCKED uit B1)
8. **Alle visuals reactief op scene plan props** — geen hardcoded content

## Pre-flight

1. Verifieer Railway worker heeft minimaal 4GB RAM beschikbaar (Remotion render is RAM-intensive)
2. Als huidige plan op kleine instance draait: upgrade Railway worker naar minstens "Standard" of "Pro" tier
3. Disk space: rendered MP4 + temp files = ~500MB per render, zorg voor genoeg storage

## Taak 1 — Remotion project setup in monorepo

In de Next.js repo, maak een nieuwe top-level folder `remotion/`:

```
remotion/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── src/
│   ├── Root.tsx
│   ├── compositions/
│   │   └── VocitoLaunchVideo.tsx
│   ├── scenes/
│   │   ├── Scene1Materializes.tsx
│   │   ├── Scene2Pain01.tsx
│   │   ├── Scene3Pain02.tsx
│   │   ├── Scene4Action.tsx
│   │   ├── Scene5Promise01.tsx
│   │   ├── Scene6Promise02.tsx
│   │   ├── Scene7Tagline.tsx
│   │   └── Scene8Wordmark.tsx
│   ├── components/
│   │   ├── Blob.tsx
│   │   ├── SceneCopy.tsx
│   │   ├── NotificationBubble.tsx
│   │   └── AudioMixer.tsx
│   └── lib/
│       └── animation-helpers.ts
```

`package.json` voor remotion folder:

```json
{
  "name": "vocito-studio-remotion",
  "version": "1.0.0",
  "scripts": {
    "start": "remotion studio",
    "build": "remotion bundle",
    "render": "remotion render"
  },
  "dependencies": {
    "@remotion/bundler": "^4.0.0",
    "@remotion/cli": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "remotion": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```

`remotion.config.ts`:

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(18);
Config.setConcurrency(1); // Stabiliteit > snelheid
```

## Taak 2 — Root composition

`remotion/src/Root.tsx`:

```tsx
import { Composition } from "remotion";
import { VocitoLaunchVideo } from "./compositions/VocitoLaunchVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VocitoLaunchVideo"
      component={VocitoLaunchVideo}
      durationInFrames={990}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        scenePlan: null as any,
        assetUrls: {} as Record<string, string>,
      }}
    />
  );
};
```

## Taak 3 — Main composition

`remotion/src/compositions/VocitoLaunchVideo.tsx`:

```tsx
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import { Scene1Materializes } from "../scenes/Scene1Materializes";
import { Scene2Pain01 } from "../scenes/Scene2Pain01";
import { Scene3Pain02 } from "../scenes/Scene3Pain02";
import { Scene4Action } from "../scenes/Scene4Action";
import { Scene5Promise01 } from "../scenes/Scene5Promise01";
import { Scene6Promise02 } from "../scenes/Scene6Promise02";
import { Scene7Tagline } from "../scenes/Scene7Tagline";
import { Scene8Wordmark } from "../scenes/Scene8Wordmark";

type Props = {
  scenePlan: any;
  assetUrls: Record<string, string>;
};

const SCENE_BOUNDARIES = [
  { id: "scene1_materializes", from: 0, duration: 90, Component: Scene1Materializes },
  { id: "scene2_pain_01", from: 90, duration: 90, Component: Scene2Pain01 },
  { id: "scene3_pain_02", from: 180, duration: 90, Component: Scene3Pain02 },
  { id: "scene4_action", from: 270, duration: 180, Component: Scene4Action },
  { id: "scene5_promise_01", from: 450, duration: 120, Component: Scene5Promise01 },
  { id: "scene6_promise_02", from: 570, duration: 120, Component: Scene6Promise02 },
  { id: "scene7_tagline", from: 690, duration: 180, Component: Scene7Tagline },
  { id: "scene8_wordmark", from: 870, duration: 120, Component: Scene8Wordmark },
];

export const VocitoLaunchVideo: React.FC<Props> = ({ scenePlan, assetUrls }) => {
  if (!scenePlan) return null;

  const sceneById = (id: string) => scenePlan.scenes.find((s: any) => s.id === id);

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      
      {/* MUSIC — full duration with ducking */}
      {assetUrls.music_main && (
        <Audio
          src={assetUrls.music_main}
          volume={(f) => calculateMusicVolume(f, scenePlan)}
        />
      )}

      {/* VOICEOVER — full duration */}
      {assetUrls.vo_main && (
        <Audio
          src={assetUrls.vo_main}
          volume={scenePlan.audio.mixLevels.voVolume ?? 1.0}
        />
      )}

      {/* SFX per scene */}
      {scenePlan.scenes.map((scene: any) =>
        (scene.audio.sfxRequests || []).map((sfx: any, idx: number) => {
          const key = `sfx_${scene.id}_${idx}`;
          const url = assetUrls[key];
          if (!url) return null;
          return (
            <Sequence
              key={key}
              from={scene.frameStart + (sfx.frameOffset || 0)}
              durationInFrames={150}
            >
              <Audio src={url} volume={sfx.volume ?? 0.35} />
            </Sequence>
          );
        })
      )}

      {/* SCENES — visual layers */}
      {SCENE_BOUNDARIES.map(({ id, from, duration, Component }) => {
        const scene = sceneById(id);
        if (!scene) return null;
        return (
          <Sequence key={id} from={from} durationInFrames={duration}>
            <Component scene={scene} brand={scenePlan.meta.brand} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

function calculateMusicVolume(frame: number, scenePlan: any): number {
  const base = scenePlan.audio.mixLevels.musicBase ?? 0.55;
  const ducked = scenePlan.audio.mixLevels.musicDuckedDuringVO ?? 0.28;
  // Duck during VO scenes (frames 90-870), full volume tijdens stille opener en outro
  if (frame < 90 || frame >= 870) return base;
  return ducked;
}
```

## Taak 4 — Blob component (volledig animated)

`remotion/src/components/Blob.tsx`:

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

type Props = {
  state: "hidden" | "materializing" | "breathing" | "pulsing" | "fading";
  scale: number;
  opacity: number;
  position: "center" | "top" | "bottom" | "left" | "right";
  accentColor?: string;
  successColor?: string;
};

export const Blob: React.FC<Props> = ({
  state,
  scale,
  opacity,
  position,
  accentColor = "#a78bff",
  successColor = "#5eead4",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let animatedScale = scale;
  let animatedOpacity = opacity;

  if (state === "hidden") {
    animatedOpacity = 0;
    animatedScale = 0.3;
  } else if (state === "materializing") {
    animatedOpacity = interpolate(frame, [0, 60], [0, opacity], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const matScale = spring({ frame, fps, from: 0.5, to: scale, config: { damping: 30, mass: 1 } });
    animatedScale = matScale;
  } else if (state === "breathing") {
    const breath = Math.sin(frame / fps * 1.2) * 0.04;
    animatedScale = scale + breath;
  } else if (state === "pulsing") {
    const pulse = Math.sin(frame / fps * 2.5) * 0.06;
    animatedScale = scale + pulse;
  } else if (state === "fading") {
    animatedOpacity = interpolate(frame, [0, 60], [opacity, 0.15], {
      extrapolateRight: "clamp",
    });
    animatedScale = interpolate(frame, [0, 60], [scale, scale * 0.8], {
      extrapolateRight: "clamp",
    });
  }

  const positionStyles: Record<string, React.CSSProperties> = {
    center: { alignItems: "center", justifyContent: "center" },
    top: { alignItems: "flex-start", justifyContent: "center", paddingTop: 200 },
    bottom: { alignItems: "flex-end", justifyContent: "center", paddingBottom: 200 },
    left: { alignItems: "center", justifyContent: "flex-start", paddingLeft: 200 },
    right: { alignItems: "center", justifyContent: "flex-end", paddingRight: 200 },
  };

  return (
    <AbsoluteFill style={{ display: "flex", ...positionStyles[position] }}>
      <div
        style={{
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor} 0%, ${successColor} 55%, transparent 100%)`,
          filter: "blur(60px)",
          transform: `scale(${animatedScale})`,
          opacity: animatedOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
```

## Taak 5 — SceneCopy component

`remotion/src/components/SceneCopy.tsx`:

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

type Props = {
  copy: any;
};

const FONT_FAMILY_MAP: Record<string, string> = {
  serif_italic: "'Fraunces', Georgia, serif",
  sans_display: "'Satoshi', system-ui, sans-serif",
  mono_label: "'JetBrains Mono', monospace",
};

const FONT_SIZE_MAP: Record<string, number> = {
  sm: 36,
  md: 56,
  lg: 84,
  xl: 120,
};

const POSITION_MAP: Record<string, React.CSSProperties> = {
  center: { alignItems: "center", justifyContent: "center" },
  top: { alignItems: "flex-start", justifyContent: "center", paddingTop: 180 },
  bottom: { alignItems: "flex-end", justifyContent: "center", paddingBottom: 180 },
};

export const SceneCopy: React.FC<Props> = ({ copy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!copy) return null;

  const animDurationFrames = Math.round((copy.animationDurationMs || 800) / 1000 * fps);

  let opacity = 1;
  let translateY = 0;
  let translateX = 0;
  let scale = 1;

  if (copy.animation === "fade_up") {
    opacity = interpolate(frame, [0, animDurationFrames], [0, 1], {
      extrapolateRight: "clamp",
    });
    translateY = interpolate(frame, [0, animDurationFrames], [40, 0], {
      extrapolateRight: "clamp",
    });
  } else if (copy.animation === "fade_in") {
    opacity = interpolate(frame, [0, animDurationFrames], [0, 1], {
      extrapolateRight: "clamp",
    });
  } else if (copy.animation === "split_reveal") {
    opacity = interpolate(frame, [0, animDurationFrames], [0, 1], {
      extrapolateRight: "clamp",
    });
    scale = spring({
      frame,
      fps,
      from: 0.92,
      to: 1.0,
      config: { damping: 200, mass: 0.8 },
    });
  }

  const fontFamily = FONT_FAMILY_MAP[copy.style] || FONT_FAMILY_MAP.sans_display;
  const fontStyle = copy.style === "serif_italic" ? "italic" : "normal";
  const fontSize = FONT_SIZE_MAP[copy.size] || 56;
  const positionStyle = POSITION_MAP[copy.position] || POSITION_MAP.center;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        padding: 120,
        ...positionStyle,
      }}
    >
      <div
        style={{
          fontFamily,
          fontStyle,
          fontSize,
          fontWeight: copy.style === "sans_display" ? 600 : 400,
          color: "#f0f4ff",
          textAlign: "center",
          maxWidth: 1500,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          opacity,
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        }}
      >
        {copy.text}
      </div>
    </AbsoluteFill>
  );
};
```

## Taak 6 — NotificationBubble component (voor Scene 3)

`remotion/src/components/NotificationBubble.tsx`:

```tsx
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

type Props = {
  content: string;
  showFromFrame: number;
  showUntilFrame: number;
  yOffset?: number;
  globalFrame: number;
};

export const NotificationBubble: React.FC<Props> = ({
  content,
  showFromFrame,
  showUntilFrame,
  yOffset = 0,
  globalFrame,
}) => {
  const { fps } = useVideoConfig();

  if (globalFrame < showFromFrame || globalFrame > showUntilFrame) return null;

  const localFrame = globalFrame - showFromFrame;
  const slideIn = spring({
    frame: localFrame,
    fps,
    from: -100,
    to: 0,
    config: { damping: 200 },
  });

  const opacity = interpolate(localFrame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        top: 120 + yOffset,
        left: "50%",
        transform: `translateX(calc(-50% + ${slideIn}px))`,
        opacity,
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 16,
        padding: "16px 24px",
        fontFamily: "'Satoshi', system-ui, sans-serif",
        fontSize: 24,
        color: "rgba(255, 255, 255, 0.85)",
        letterSpacing: "-0.01em",
      }}
    >
      {content}
    </div>
  );
};
```

## Taak 7 — Scene components (8 stuks)

Pattern voor elke scene: import Blob + SceneCopy + eventueel UI elements, render op basis van scene props.

`Scene1Materializes.tsx`:
```tsx
import { AbsoluteFill } from "remotion";
import { Blob } from "../components/Blob";

export const Scene1Materializes: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => (
  <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
    <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
  </AbsoluteFill>
);
```

`Scene2Pain01.tsx`, `Scene5Promise01.tsx`, `Scene6Promise02.tsx`, `Scene7Tagline.tsx`:
```tsx
import { AbsoluteFill } from "remotion";
import { Blob } from "../components/Blob";
import { SceneCopy } from "../components/SceneCopy";

export const Scene2Pain01: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => (
  <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
    <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
    <SceneCopy copy={scene.visual.copy} />
  </AbsoluteFill>
);
```

(Idem voor Scene5, 6, 7 — zelfde structuur)

`Scene3Pain02.tsx` (met UI elements):
```tsx
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Blob } from "../components/Blob";
import { NotificationBubble } from "../components/NotificationBubble";

export const Scene3Pain02: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => {
  const frame = useCurrentFrame();
  const globalFrame = frame + scene.frameStart;
  
  return (
    <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
      <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
      {(scene.visual.uiElements || []).map((el: any, idx: number) => {
        if (el.type === "notification") {
          return (
            <NotificationBubble
              key={idx}
              content={el.content}
              showFromFrame={el.showFromFrame}
              showUntilFrame={el.showUntilFrame}
              yOffset={idx * 90}
              globalFrame={globalFrame}
            />
          );
        }
        return null;
      })}
    </AbsoluteFill>
  );
};
```

`Scene4Action.tsx` — zelfde als Scene2 maar met split_reveal animation in copy.

`Scene8Wordmark.tsx`:
```tsx
import { AbsoluteFill } from "remotion";
import { Blob } from "../components/Blob";
import { SceneCopy } from "../components/SceneCopy";

export const Scene8Wordmark: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => (
  <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
    <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
    <SceneCopy copy={scene.visual.copy} />
  </AbsoluteFill>
);
```

## Taak 8 — Worker Dockerfile met Chromium

In de worker repo (Railway), maak/update `Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install system dependencies for Chromium + Remotion
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 voor Remotion
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app

# Copy worker Python code
COPY worker/ ./worker/
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Remotion project
COPY remotion/ ./remotion/
WORKDIR /app/remotion
RUN npm install --omit=dev

# Pre-install Chromium voor Remotion
RUN npx remotion install --unsafe-perm

WORKDIR /app

EXPOSE 8080
CMD ["uvicorn", "worker.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Belangrijk: zorg dat `nixpacks.toml` wordt verwijderd of ingesteld zodat Railway de Dockerfile gebruikt:

```toml
# railway.toml of nixpacks vervangen door:
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
```

## Taak 9 — Worker render code

Vervang de huidige FFmpeg stub render functie. In `worker/render_pipeline.py`:

```python
"""
Remotion render pipeline. Vervangt de oude FFmpeg stub.
"""

import os
import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path

from supabase import create_client, Client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
REMOTION_PROJECT_PATH = "/app/remotion"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


async def render_video_with_remotion(
    run_id: str,
    prompt_id: str,
    scene_plan: dict,
    asset_urls: dict,
) -> str:
    """
    Render MP4 via Remotion CLI. Returns local path to MP4 file.
    Raises on failure.
    """
    output_path = f"/tmp/render_{run_id}.mp4"
    
    # Schrijf props naar tijdelijk JSON file (te groot voor CLI arg)
    props_path = f"/tmp/props_{run_id}.json"
    props_data = {
        "scenePlan": scene_plan,
        "assetUrls": asset_urls,
    }
    with open(props_path, "w") as f:
        json.dump(props_data, f)
    
    cmd = [
        "npx",
        "remotion",
        "render",
        "VocitoLaunchVideo",
        output_path,
        f"--props={props_path}",
        "--codec=h264",
        "--crf=18",
        "--concurrency=1",
        "--log=info",
    ]
    
    logger.info(f"[remotion] Starting render for {run_id}")
    
    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=REMOTION_PROJECT_PATH,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    
    stdout, stderr = await process.communicate()
    
    if process.returncode != 0:
        error_text = stderr.decode()[:2000]
        logger.error(f"[remotion] Render failed: {error_text}")
        raise Exception(f"Remotion render failed: {error_text}")
    
    if not Path(output_path).exists():
        raise Exception(f"Remotion completed but output file missing: {output_path}")
    
    file_size = Path(output_path).stat().st_size
    logger.info(f"[remotion] Render complete: {output_path} ({file_size} bytes)")
    
    # Cleanup props file
    Path(props_path).unlink(missing_ok=True)
    
    return output_path


async def upload_video_to_storage(run_id: str, local_path: str) -> tuple[str, int]:
    """Upload MP4 to studio-videos bucket. Returns (storage_path, file_size)."""
    storage_path = f"renders/{run_id}.mp4"
    
    with open(local_path, "rb") as f:
        video_bytes = f.read()
    
    file_size = len(video_bytes)
    
    supabase.storage.from_("studio-videos").upload(
        storage_path,
        video_bytes,
        file_options={"content-type": "video/mp4", "upsert": "true"},
    )
    
    # Cleanup local file
    Path(local_path).unlink(missing_ok=True)
    
    logger.info(f"[storage] Uploaded {storage_path} ({file_size} bytes)")
    return storage_path, file_size


async def render_plan_full(prompt_id: str):
    """
    Full pipeline: VO genereren (al gedaan in B3) → asset URLs ophalen → 
    Remotion render → upload MP4 → update video_run.
    """
    logger.info(f"[render-pipeline] Starting full render for {prompt_id}")
    
    # Update render_status to rendering
    supabase.table("studio_prompts").update({
        "render_status": "rendering",
    }).eq("id", prompt_id).execute()
    
    # Find the video_run row (created by B3 VO generation step)
    run_response = supabase.table("studio_video_runs").select("*").eq(
        "prompt_id", prompt_id
    ).order("created_at", desc=True).limit(1).execute()
    
    if not run_response.data:
        raise Exception(f"No video_run found for prompt {prompt_id}")
    
    run = run_response.data[0]
    run_id = run["id"]
    
    try:
        # Update step
        supabase.table("studio_video_runs").update({
            "status": "rendering",
            "current_step": "Rendering video with Remotion",
            "progress_percent": 50,
        }).eq("id", run_id).execute()
        
        # Get scene plan
        plan_response = supabase.table("studio_prompts").select("scene_plan").eq("id", prompt_id).single().execute()
        scene_plan = plan_response.data["scene_plan"]
        
        # Build asset URL map (signed URLs)
        asset_urls = await build_asset_url_map(prompt_id)
        
        if "music_main" not in asset_urls:
            raise Exception("Music asset missing")
        if "vo_main" not in asset_urls:
            raise Exception("VO asset missing")
        
        # Render
        local_mp4 = await render_video_with_remotion(run_id, prompt_id, scene_plan, asset_urls)
        
        # Upload
        storage_path, file_size = await upload_video_to_storage(run_id, local_mp4)
        
        # Mark complete
        supabase.table("studio_video_runs").update({
            "status": "completed",
            "current_step": "Video rendered. Ready to download.",
            "progress_percent": 100,
            "output_url": storage_path,
            "file_size_bytes": file_size,
            "duration_seconds": 33,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", run_id).execute()
        
        supabase.table("studio_prompts").update({
            "render_status": "completed",
        }).eq("id", prompt_id).execute()
        
        logger.info(f"[render-pipeline] Completed render for {prompt_id}")
        
    except Exception as e:
        logger.exception(f"[render-pipeline] Failed for {prompt_id}: {e}")
        supabase.table("studio_video_runs").update({
            "status": "failed",
            "current_step": f"Render failed",
            "error_message": str(e)[:1000],
        }).eq("id", run_id).execute()
        supabase.table("studio_prompts").update({
            "render_status": "failed",
        }).eq("id", prompt_id).execute()
        raise


async def build_asset_url_map(prompt_id: str) -> dict:
    """Generate signed URLs (2 hour expiry) voor alle linked assets."""
    response = supabase.table("studio_prompt_assets").select(
        "*, asset:studio_assets(*)"
    ).eq("prompt_id", prompt_id).execute()
    
    url_map = {}
    for link in response.data or []:
        asset = link.get("asset")
        if not asset:
            continue
        
        bucket = asset.get("storage_bucket", "studio-assets")
        path = asset.get("storage_path") or asset.get("supabase_storage_path")
        if not path:
            continue
        
        signed = supabase.storage.from_(bucket).create_signed_url(path, 7200)
        signed_url = signed.get("signedURL") or signed.get("signed_url")
        
        usage_context = link.get("usage_context", "unknown")
        url_map[usage_context] = signed_url
    
    return url_map
```

## Taak 10 — Update render poll loop

In de bestaande poll loop, vervang de FFmpeg stub call met `render_plan_full()`:

```python
# In poll loop, waar de render trigger zit:
from worker.render_pipeline import render_plan_full

async def render_poll_loop():
    while True:
        try:
            response = supabase.table("studio_prompts").select(
                "id"
            ).eq("status", "plan_approved").eq(
                "assets_status", "ready"
            ).is_("render_status", "null").order("created_at").limit(1).execute()
            
            if response.data:
                prompt_id = response.data[0]["id"]
                logger.info(f"[render-poll] Found plan {prompt_id}, starting render")
                
                # Set to pending immediately to prevent duplicate pickup
                supabase.table("studio_prompts").update({
                    "render_status": "pending"
                }).eq("id", prompt_id).execute()
                
                # Run full pipeline
                await render_plan_full(prompt_id)
                
        except Exception as e:
            logger.exception(f"[render-poll] Loop error: {e}")
        
        await asyncio.sleep(5)
```

## Taak 11 — UI cleanup: verwijder fake video player

In `src/app/(app)/plan/[id]/plan-review-content.tsx`:

1. **Verwijder** de hele "fake video player" sectie met de geanimeerde div blob, copy overlay, scene labels, progress bar (de hele block met `aspect-ratio: 16/9` en de div met radial-gradient).

2. **Vervang door** een eenvoudige render status sectie:

```tsx
<div className="rounded-xl border border-border bg-ui-elevated">
  <div className="p-5">
    <p className="label-mono mb-3">RENDER</p>
    
    {!videoRun || videoRun.status === "pending" && (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-foreground-muted">Queued for render...</span>
      </div>
    )}
    
    {videoRun?.status === "generating_vo" && (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <span>Generating voice-over...</span>
      </div>
    )}
    
    {videoRun?.status === "rendering" && (
      <div>
        <div className="flex items-center gap-2 text-sm mb-2">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span>Rendering video... ({videoRun.progress_percent ?? 0}%)</span>
        </div>
        <div className="h-1 bg-ui rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent transition-all duration-500" 
            style={{ width: `${videoRun.progress_percent ?? 0}%` }} 
          />
        </div>
        <p className="text-xs text-foreground-subtle mt-2">{videoRun.current_step}</p>
      </div>
    )}
    
    {videoRun?.status === "completed" && videoRun.signed_url && (
      <div>
        <video
          src={videoRun.signed_url}
          controls
          playsInline
          className="w-full rounded-lg bg-black"
          style={{ aspectRatio: "16 / 9" }}
        />
        <div className="mt-3 flex items-center gap-3">
          <a
            href={videoRun.signed_url}
            download={`vocito-launch-${videoRun.id}.mp4`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent text-background hover:bg-accent/90 h-10 px-4 text-sm font-medium transition-all"
          >
            <Download className="h-4 w-4" />
            Download MP4
          </a>
          <span className="text-xs text-foreground-subtle font-mono">
            {((videoRun.file_size_bytes ?? 0) / 1024 / 1024).toFixed(1)} MB · 1920×1080 · 33s
          </span>
        </div>
      </div>
    )}
    
    {videoRun?.status === "failed" && (
      <div className="text-sm text-destructive">
        Render failed: {videoRun.error_message ?? "Unknown error"}
      </div>
    )}
  </div>
</div>
```

3. **Backend route fix**: in `/api/plan/[id]/runs/route.ts` (of waar ook video_run wordt opgehaald), zorg dat de signed URL voor `output_url` wordt gegenereerd voordat het naar de client gaat:

```ts
// In de runs API route:
if (run.output_url && run.status === "completed") {
  const { data: signed } = await supabase.storage
    .from("studio-videos")
    .createSignedUrl(run.output_url, 7200);
  run.signed_url = signed?.signedUrl;
}
```

## Taak 12 — Build + deploy

1. **Lokaal test eerst**:
   ```bash
   cd remotion
   npm install
   npx remotion studio  # opent preview in browser
   ```
   Verifieer dat blob, copy, animations correct renderen op localhost:3000.

2. **Test een handmatige render lokaal**:
   ```bash
   npx remotion render VocitoLaunchVideo /tmp/test.mp4 --props=test-props.json
   ```
   Met een test-props.json die een echte scene plan bevat.

3. **Deploy worker naar Railway** via `railway up`. Eerste deploy duurt 5-10 min vanwege Chromium install.

4. **Deploy Next.js naar Vercel** via git push.

5. **Reset plan b3aac8bb voor nieuwe render**:
   ```sql
   UPDATE studio_prompts 
   SET render_status = NULL 
   WHERE id = 'b3aac8bb-e487-4ff2-9238-2254dfb048bc';
   
   DELETE FROM studio_video_runs 
   WHERE prompt_id = 'b3aac8bb-e487-4ff2-9238-2254dfb048bc';
   ```

6. **Watch Railway logs**. Render zou moeten triggeren binnen 10 sec na reset. Zie `[render-pipeline]` en `[remotion]` log entries.

## Taak 13 — Test protocol

Volg deze stappen, rapporteer resultaten per stap:

1. Eerste render duurt 1-3 min. Check Railway memory/CPU usage tijdens render.
2. Open studio.vocito.ai/plan/b3aac8bb-... en zie video player na completion.
3. Klik download MP4 — zou een echt .mp4 bestand moeten downloaden, geen .html.
4. Open MP4 in QuickTime / VLC. Verifieer:
   - Audio klopt (music + VO + SFX gemixed)
   - Visuals zichtbaar (blob, copy fades, animations)
   - 33 seconden lang
   - 1920x1080 resolutie
   - Scene boundaries correct (frame timings)
5. File size moet tussen 30-200MB liggen.

## Wat NIET in B3.1

- Geen video editing UI (later)
- Geen multi-variant renders (later)
- Geen render kwaliteit instellingen door user (vast op CRF 18)
- Geen aspect ratio toggle (alleen 1920x1080)
- Geen subtitle/caption support
- Geen color grading per scene

## Rapport vereisten

Na deploy + test:

1. Status per taak (1-13)
2. Render time gemeten op Railway (gemiddelde over 2-3 runs)
3. MP4 file size voor plan b3aac8bb
4. Eventuele crashes of memory issues
5. Screenshots van eerste 4 frames extracted uit MP4 (om visueel te bevestigen dat blob + copy renderen)
6. Vergelijking met de huidige stub MP4 (verschil in bitrate, file size, visuele content)

Einde brief B3.1.