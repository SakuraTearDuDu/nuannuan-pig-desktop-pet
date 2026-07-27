const { createStandardPetApp } = require('./standard-pet-main');

createStandardPetApp({
  appDisplayName: '财神鸡桌面宠物',
  petId: 'caishen-ji',
  rendererHtml: 'caishen-ji.html',
  smokeEnvVar: 'CAISHEN_JI_PET_SMOKE_TEST',
  expectedSpriteVersionNumber: 2,
  expectedAtlasRows: 11
});
