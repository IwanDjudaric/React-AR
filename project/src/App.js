import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const threeMountRef = useRef(null);
  const rendererRef = useRef(null);
  const frameRef = useRef(null);
  const modelRef = useRef(null);

  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 50,
    originY: 56,
  });

  const [cameraStatus, setCameraStatus] = useState('idle');
  const [cameraMessage, setCameraMessage] = useState('Tap "Enable Camera" to begin.');
  const [modelStatus, setModelStatus] = useState('loading');
  const [modelMessage, setModelMessage] = useState('Loading t-shirt model...');
  const [overlayScale, setOverlayScale] = useState(52);
  const [overlayX, setOverlayX] = useState(50);
  const [overlayY, setOverlayY] = useState(56);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraMessage('This browser does not support camera access.');
      return;
    }

    try {
      setCameraStatus('requesting');
      setCameraMessage('Requesting camera permission...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      stopCamera();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus('granted');
      setCameraMessage('Live camera ready. Drag and resize the t-shirt overlay.');
    } catch (error) {
      const denied =
        error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      setCameraStatus(denied ? 'denied' : 'error');
      setCameraMessage(
        denied
          ? 'Camera permission denied. Allow access and try again.'
          : 'Could not start camera. Check permissions and device availability.'
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    const mount = threeMountRef.current;
    if (!mount || typeof window === 'undefined' || !window.WebGLRenderingContext) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.2, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const hemiLight = new THREE.HemisphereLight(0xf5f8ff, 0x273035, 1.35);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(2.8, 3.6, 2.2);
    const rimLight = new THREE.DirectionalLight(0x8ee6ff, 0.72);
    rimLight.position.set(-2.8, 1.4, -1.8);
    scene.add(hemiLight, keyLight, rimLight);

    const modelPivot = new THREE.Group();
    scene.add(modelPivot);
    modelRef.current = modelPivot;

    const addFallbackModel = () => {
      // Simple fallback silhouette so users still see overlay placement.
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 1.62, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x45b3ff, roughness: 0.5, metalness: 0.08 })
      );
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.2, 24),
        new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.35, metalness: 0.12 })
      );
      const sleeveLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.42, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x61c0ff, roughness: 0.45, metalness: 0.1 })
      );
      const sleeveRight = sleeveLeft.clone();

      neck.position.set(0, 0.8, 0);
      sleeveLeft.position.set(-0.93, 0.42, 0);
      sleeveRight.position.set(0.93, 0.42, 0);

      const fallback = new THREE.Group();
      fallback.add(body, neck, sleeveLeft, sleeveRight);
      fallback.position.y = -0.05;
      fallback.rotation.y = Math.PI;
      modelPivot.add(fallback);
    };

    let canceled = false;

    const loadModel = async () => {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        if (canceled) {
          return;
        }

        const loader = new GLTFLoader();
        setModelStatus('loading');
        setModelMessage('Loading t-shirt model...');

        loader.load(
          process.env.PUBLIC_URL + '/models/t-shirt.glb',
          (gltf) => {
            if (canceled) {
              return;
            }
            modelPivot.clear();
            const shirt = gltf.scene;

            // Normalize unknown model dimensions so it is always visible.
            const bounds = new THREE.Box3().setFromObject(shirt);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            bounds.getCenter(center);
            bounds.getSize(size);

            const maxAxis = Math.max(size.x, size.y, size.z) || 1;
            const fitScale = 2.35 / maxAxis;

            // Shift the model's center to local origin
            shirt.position.copy(center).multiplyScalar(-1);

            // Wrap in a scaler group so scale applies after centering
            const wrapper = new THREE.Group();
            wrapper.add(shirt);
            wrapper.scale.setScalar(fitScale);

            // Slightly lower the model to sit naturally in the overlay frame.
            wrapper.position.y -= size.y * fitScale * 0.08;
            wrapper.rotation.y = Math.PI;

            shirt.traverse((node) => {
              if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
              }
            });
            modelPivot.add(wrapper);
            setModelStatus('loaded');
            setModelMessage('Model loaded. Enable camera if needed, then drag to position.');
          },
          (event) => {
            if (!event.total) {
              return;
            }
            const progress = Math.round((event.loaded / event.total) * 100);
            setModelMessage(`Loading t-shirt model... ${progress}%`);
          },
          (error) => {
            const details = error?.message ? ` (${error.message})` : '';
            setModelStatus('error');
            setModelMessage(`Model failed to load${details}. Showing fallback shape.`);
            addFallbackModel();
          }
        );
      } catch (e) {
        console.error("Three.js initialization error:", e);
        setModelStatus('error');
        setModelMessage('Model loader failed to initialize. Showing fallback shape.');
        addFallbackModel();
      }
    };

    loadModel();

    const updateRendererSize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) {
        return;
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    updateRendererSize();

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateRendererSize);
      resizeObserver.observe(mount);
    } else {
      window.addEventListener('resize', updateRendererSize);
    }

    let frameId = 0;
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.004;
      }
      renderer.render(scene, camera);
    };
    animate();
    frameRef.current = frameId;

    return () => {
      canceled = true;
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updateRendererSize);
      }
      modelPivot.clear();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handlePointerDown = (event) => {
    dragStateRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: overlayX,
      originY: overlayY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragStateRef.current.dragging) {
      return;
    }
    const dx = event.clientX - dragStateRef.current.startX;
    const dy = event.clientY - dragStateRef.current.startY;
    const nextX = dragStateRef.current.originX + (dx / window.innerWidth) * 100;
    const nextY = dragStateRef.current.originY + (dy / window.innerHeight) * 100;

    setOverlayX(clamp(nextX, 8, 92));
    setOverlayY(clamp(nextY, 18, 90));
  };

  const stopDragging = (event) => {
    if (dragStateRef.current.dragging) {
      dragStateRef.current.dragging = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const overlayWidth = useMemo(
    () => `clamp(170px, ${overlayScale}vw, 480px)`,
    [overlayScale]
  );

  return (
    <div className="app-shell">
      <header className="hero-bar">
        <p className="eyebrow">Mobile AR Overlay</p>
        <h1>Virtual Tee Overlay</h1>
        <p className="subtitle">Uses your camera feed and places a draggable 3D t-shirt on top. No body tracking.</p>
      </header>

      <main className="camera-stage">
        <video ref={videoRef} className="camera-video" muted playsInline autoPlay />
        <div className="video-fx" />

        <div
          className="overlay-frame"
          style={{
            left: `${overlayX}%`,
            top: `${overlayY}%`,
            width: overlayWidth,
          }}
        >
          <div ref={threeMountRef} className="shirt-renderer" aria-label="3D t-shirt overlay" />
          <button
            type="button"
            className="drag-handle"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            Drag Shirt
          </button>
        </div>

        <div className="status-chip" data-state={cameraStatus}>
          <p>{cameraMessage}</p>
          <p data-model-state={modelStatus}>{modelMessage}</p>
        </div>
      </main>

      <section className="control-panel">
        <div className="control-row">
          <label htmlFor="sizeRange">Overlay size</label>
          <output>{overlayScale}%</output>
        </div>
        <input
          id="sizeRange"
          type="range"
          min="35"
          max="80"
          value={overlayScale}
          onChange={(event) => setOverlayScale(Number(event.target.value))}
        />

        <div className="button-row">
          <button type="button" className="primary" onClick={startCamera}>
            {cameraStatus === 'granted' ? 'Restart Camera' : 'Enable Camera'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setOverlayX(50);
              setOverlayY(56);
              setOverlayScale(52);
            }}
          >
            Reset Overlay
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
