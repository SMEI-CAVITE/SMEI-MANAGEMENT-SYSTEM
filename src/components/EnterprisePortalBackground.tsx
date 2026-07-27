import React, { useEffect, useRef } from "react";
import { NeatGradient } from "@firecms/neat";

export default function EnterprisePortalBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    let gradient: NeatGradient | null = null;

    const config = {
      ref: canvas,

      /*
       * REFERENCE COLOR PALETTE - "Neat" Preset
       */
      colors: [
        {
          color: "#FF4747",
          enabled: true,
        },
        {
          color: "#FFC1C1",
          enabled: true,
        },
        {
          color: "#FF0000",
          enabled: true,
        },
        {
          color: "#910000",
          enabled: true,
        },
        {
          color: "#CBD5E1",
          enabled: true,
        },
        {
          color: "#ffffff",
          enabled: true,
        },
      ],

      /*
       * Animation
       */
      speed: 8.0,

      horizontalPressure: 3,
      verticalPressure: 4,

      waveFrequencyX: 2,
      waveFrequencyY: 3,
      waveAmplitude: 5,

      /*
       * Lighting
       */
      shadows: 1,
      highlights: 5,

      colorBrightness: 1,
      colorSaturation: 7,

      wireframe: false,
      colorBlending: 8,

      /*
       * Background base color used for blending
       */
      backgroundColor: "#003FFF",
      backgroundAlpha: 1,

      /*
       * Performance
       */
      resolution: 1,

      /*
       * Grain disabled
       */
      grainScale: 0,
      grainSparsity: 0,
      grainIntensity: 0,
      grainSpeed: 1,

      /*
       * Vertical movement
       */
      yOffset: 0.0999755859375,
      yOffsetWaveMultiplier: 4,
      yOffsetColorMultiplier: 4,
      yOffsetFlowMultiplier: 4,

      /*
       * Flow
       */
      flowDistortionA: 0,
      flowDistortionB: 0,
      flowScale: 1,
      flowEase: 0,
      flowEnabled: true,

      /*
       * Procedural textures disabled
       * for cleaner and more predictable colors.
       */
      enableProceduralTexture: false,
      transparentTextureVoid: false,

      textureVoidLikelihood: 0.45,
      textureVoidWidthMin: 200,
      textureVoidWidthMax: 486,
      textureBandDensity: 2.15,
      textureColorBlending: 0.01,
      textureSeed: 333,
      textureEase: 0.5,

      textureShapeTriangles: 20,
      textureShapeCircles: 15,
      textureShapeBars: 15,
      textureShapeSquiggles: 10,

      /*
       * Domain warp disabled
       */
      domainWarpEnabled: false,
      domainWarpIntensity: 0,
      domainWarpScale: 3,

      /*
       * Vignette disabled
       */
      vignetteIntensity: 0,
      vignetteRadius: 0.8,

      /*
       * Fresnel disabled
       */
      fresnelEnabled: false,
      fresnelPower: 2,
      fresnelIntensity: 0.5,
      fresnelColor: "#FFFFFF",

      /*
       * Iridescence disabled
       */
      iridescenceEnabled: false,
      iridescenceIntensity: 0.5,
      iridescenceSpeed: 1,

      /*
       * Bloom disabled
       */
      bloomIntensity: 0,
      bloomThreshold: 0.7,

      /*
       * Chromatic aberration disabled
       */
      chromaticAberration: 0,

      /*
       * Geometry
       */
      shapeType: "plane" as const,

      shapeRotationX: 0,
      shapeRotationY: 0,
      shapeRotationZ: 0,

      shapeAutoRotateSpeedX: 0,
      shapeAutoRotateSpeedY: 0,

      sphereRadius: 15,
      torusRadius: 15,
      torusTube: 5,

      cylinderRadius: 10,
      cylinderHeight: 40,

      planeBend: 0,
      planeTwist: 0,

      silhouetteFade: 0.25,
      cylinderFade: 0.08,
      ribbonFade: 0.05,

      flatShading: true,

      /*
       * Camera
       */
      cameraLock: true,

      cameraX: 0,
      cameraY: 0,
      cameraZ: 0,

      cameraRotationX: 0,
      cameraRotationY: 0,
      cameraRotationZ: 0,

      cameraZoom: 1,
    };

    try {
      gradient = new NeatGradient(config);
    } catch (error) {
      console.error(
        "Failed to initialize Enterprise Portal background:",
        error
      );
    }

    /*
     * Proper cleanup is important.
     *
     * This prevents the animation from continuing after
     * leaving the Enterprise Control Portal.
     */
    return () => {
      if (!gradient) return;

      try {
        const anyGradient = gradient as any;
        if (typeof anyGradient.destroy === "function") {
          anyGradient.destroy();
        } else if (typeof anyGradient.dispose === "function") {
          anyGradient.dispose();
        }
      } catch (error) {
        console.error(
          "Failed to destroy Enterprise Portal background:",
          error
        );
      }

      gradient = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="neat-gradient-canvas"
      aria-hidden="true"
      className="absolute inset-0 z-0 h-full w-full pointer-events-none"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}