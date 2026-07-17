const { createStandardPetApp } = require('./standard-pet-main');

createStandardPetApp({
  appDisplayName: '暖暖鸡（学生小猪版）桌面宠物',
  petId: 'nuannuanji-student-pig',
  rendererHtml: 'nuannuanji-student-pig.html',
  smokeEnvVar: 'NUANNUANJI_STUDENT_PIG_PET_SMOKE_TEST',
  expectedSpriteVersionNumber: 2,
  expectedAtlasRows: 11
});
