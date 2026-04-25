import { registerRoot, Composition } from "remotion";
import { VocitoLaunchVideo } from "./compositions/VocitoLaunchVideo";

const RemotionRoot: React.FC = () => {
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

registerRoot(RemotionRoot);
