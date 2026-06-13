import { useEffect, useRef } from "react";
import { MagazineScene } from "./magazineScene.js";

export default function App() {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const scene = new MagazineScene(hostRef.current);
    scene.start();

    return () => scene.dispose();
  }, []);

  return <main ref={hostRef} className="magazine-stage" aria-label="Magazine prototype" />;
}
