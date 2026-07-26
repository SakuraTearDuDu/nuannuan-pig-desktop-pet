const { createStandardPetApp } = require('./standard-pet-main');

createStandardPetApp({
  appDisplayName: '跳舞鸡桌面宠物',
  petId: 'tiaowuji',
  rendererHtml: 'tiaowuji.html',
  smokeEnvVar: 'TIAOWUJI_PET_SMOKE_TEST',
  expectedSpriteVersionNumber: 2,
  expectedAtlasRows: 11
});
