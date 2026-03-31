(async () => {
try {
  const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  console.log('Imports succeeded');
  console.log(typeof GLTFLoader, typeof DRACOLoader, typeof MeshoptDecoder);
} catch (e) {
  console.error('Import failed', e);
}
})();
