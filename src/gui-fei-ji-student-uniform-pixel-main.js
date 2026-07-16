const { createStandardPetApp } = require('./standard-pet-main');

createStandardPetApp({
  appDisplayName: '贵妃鸡（学生服）桌面宠物',
  petId: 'gui-fei-ji-student-uniform-pixel',
  rendererHtml: 'gui-fei-ji-student-uniform-pixel.html',
  smokeEnvVar: 'GUI_FEI_JI_STUDENT_UNIFORM_PIXEL_PET_SMOKE_TEST',
  expectedSpriteVersionNumber: 2,
  expectedAtlasRows: 11
});
