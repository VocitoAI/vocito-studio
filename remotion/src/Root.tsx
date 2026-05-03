import { registerRoot, Composition, CalculateMetadataFunction } from "remotion";
import { VocitoLaunchVideo } from "./compositions/VocitoLaunchVideo";
import { VocitoNicheVideo } from "./compositions/VocitoNicheVideo";
import { VocitoTestimonial } from "./compositions/VocitoTestimonial";
import { VocitoAdShort } from "./compositions/VocitoAdShort";
import { VocitoUniversal } from "./compositions/VocitoUniversal";

const defaultProps = {
  scenePlan: null as any,
  assetUrls: {} as Record<string, string>,
};

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VocitoLaunchVideo"
        component={VocitoLaunchVideo}
        durationInFrames={990}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
      />
      <Composition
        id="VocitoNicheVideo"
        component={VocitoNicheVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
      />
      <Composition
        id="VocitoTestimonial"
        component={VocitoTestimonial}
        durationInFrames={1350}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
      />
      <Composition
        id="VocitoAdShort"
        component={VocitoAdShort}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />
      <Composition
        id="VocitoUniversal"
        component={VocitoUniversal}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={({ props }: { props: any }) => {
          const plan = props.scenePlan;
          if (!plan?.meta) return {};
          const aspect = plan.meta.aspectRatio;
          return {
            durationInFrames: plan.meta.totalFrames || 900,
            width: aspect === "9:16" || aspect === "1080x1920" ? 1080 : 1920,
            height: aspect === "9:16" || aspect === "1080x1920" ? 1920 : 1080,
          };
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
