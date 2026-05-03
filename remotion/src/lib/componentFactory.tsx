import React from "react";
import { AbsoluteFill } from "remotion";
import { Blob } from "../components/Blob";
import { SceneCopy } from "../components/SceneCopy";
import { CtaButton } from "../components/CtaButton";
import { CustomerQuote } from "../components/CustomerQuote";
import { NotificationBubble } from "../components/NotificationBubble";

/**
 * Component types Claude can assign to scenes.
 * The factory maps these to React components.
 */
export type ComponentType =
  | "blob_only"
  | "blob_copy"
  | "blob_copy_ui"
  | "customer_quote"
  | "cta_button"
  | "wordmark"
  | "fullscreen_text";

type SceneProps = {
  scene: any;
  brand: any;
  globalFrame: number;
};

/** Renders a scene based on its componentType */
export function renderScene({ scene, brand, globalFrame }: SceneProps): React.ReactNode {
  const type = scene.visual?.componentType || autoDetect(scene);
  const dur = (scene.frameEnd || 0) - (scene.frameStart || 0);

  switch (type) {
    case "blob_only":
      return (
        <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
          {scene.visual?.blob && (
            <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
          )}
        </AbsoluteFill>
      );

    case "blob_copy":
      return (
        <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
          {scene.visual?.blob && (
            <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
          )}
          {scene.visual?.copy && (
            <SceneCopy copy={scene.visual.copy} sceneDurationFrames={dur} />
          )}
        </AbsoluteFill>
      );

    case "blob_copy_ui":
      return (
        <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
          {scene.visual?.blob && (
            <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
          )}
          {scene.visual?.copy && (
            <SceneCopy copy={scene.visual.copy} sceneDurationFrames={dur} />
          )}
          {(scene.visual?.uiElements || []).map((el: any, i: number) => (
            <NotificationBubble
              key={i}
              content={el.content}
              showFromFrame={el.showFromFrame || 0}
              showUntilFrame={el.showUntilFrame || dur}
              index={i}
              globalFrame={globalFrame - (scene.frameStart || 0)}
            />
          ))}
        </AbsoluteFill>
      );

    case "customer_quote":
      return (
        <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
          {scene.visual?.blob && (
            <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
          )}
          <CustomerQuote
            quote={scene.visual?.copy?.text || ""}
            name={scene.visual?.customerName}
            role={scene.visual?.customerRole}
            company={scene.visual?.customerCompany}
          />
        </AbsoluteFill>
      );

    case "cta_button":
      return (
        <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
          {scene.visual?.blob && (
            <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
          )}
          {scene.visual?.copy && (
            <SceneCopy copy={scene.visual.copy} sceneDurationFrames={dur} />
          )}
          <CtaButton
            text={scene.visual?.ctaText || scene.meta?.cta || "Try free"}
            url={scene.visual?.ctaUrl}
            accentColor={brand.accentColor}
          />
        </AbsoluteFill>
      );

    case "wordmark":
      return (
        <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
          {scene.visual?.blob && (
            <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
          )}
          <SceneCopy
            copy={{
              ...(scene.visual?.copy || {}),
              // Enforce VOCITO in wordmark
              text: enforceVocito(scene.visual?.copy?.text),
              style: scene.visual?.copy?.style || "sans_display",
              size: scene.visual?.copy?.size || "xl",
              animation: scene.visual?.copy?.animation || "fade_in",
              position: scene.visual?.copy?.position || "center",
            }}
            sceneDurationFrames={dur}
            sceneId="scene8_wordmark"
          />
        </AbsoluteFill>
      );

    case "fullscreen_text":
      return (
        <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
          {scene.visual?.copy && (
            <SceneCopy
              copy={{
                ...scene.visual.copy,
                size: scene.visual.copy.size || "xl",
                style: scene.visual.copy.style || "sans_display",
              }}
              sceneDurationFrames={dur}
            />
          )}
        </AbsoluteFill>
      );

    default:
      // Fallback: blob + copy (safe default)
      return (
        <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
          {scene.visual?.blob && (
            <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
          )}
          {scene.visual?.copy && (
            <SceneCopy copy={scene.visual.copy} sceneDurationFrames={dur} />
          )}
        </AbsoluteFill>
      );
  }
}

/** Auto-detect component type from scene data (backward compat for legacy plans) */
function autoDetect(scene: any): ComponentType {
  const id = scene.id || "";

  if (id.includes("wordmark")) return "wordmark";
  if (id.includes("cta")) return "cta_button";
  if (id.includes("quote") || id.includes("testimonial")) return "customer_quote";
  if (scene.visual?.uiElements?.length > 0) return "blob_copy_ui";
  if (!scene.visual?.copy && !scene.audio?.voText) return "blob_only";
  if (scene.visual?.copy) return "blob_copy";

  return "blob_copy";
}

/** Ensure wordmark text contains VOCITO */
function enforceVocito(text?: string): string {
  if (!text) return "VOCITO";
  if (text.toUpperCase().includes("VOCITO")) return text;
  return "VOCITO";
}
