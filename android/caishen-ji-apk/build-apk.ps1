$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$BuildTools = Join-Path $SdkRoot 'build-tools\36.1.0'
$PlatformJar = Join-Path $SdkRoot 'platforms\android-36\android.jar'

$Aapt2 = Join-Path $BuildTools 'aapt2.exe'
$D8 = Join-Path $BuildTools 'd8.bat'
$Zipalign = Join-Path $BuildTools 'zipalign.exe'
$Apksigner = Join-Path $BuildTools 'apksigner.bat'

foreach ($Path in @($Aapt2, $D8, $Zipalign, $Apksigner, $PlatformJar)) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing Android build dependency: $Path"
  }
}

$StageRoot = Join-Path $env:TEMP 'caishen-ji-apk-stage'
$StageAppDir = Join-Path $StageRoot 'app'
$StageDistRoot = Join-Path $StageRoot 'dist'

Remove-Item -LiteralPath $StageRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $StageRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'app') -Destination $StageAppDir -Recurse -Force

$AppRoot = Join-Path $StageAppDir 'src\main'
$BuildRoot = Join-Path $StageRoot 'build'
$DistRoot = Join-Path $ProjectRoot 'dist'
$CompiledResources = Join-Path $BuildRoot 'resources.zip'
$GeneratedRoot = Join-Path $BuildRoot 'generated'
$ClassesRoot = Join-Path $BuildRoot 'classes'
$ClassesJar = Join-Path $BuildRoot 'classes.jar'
$DexRoot = Join-Path $BuildRoot 'dex'
$BaseApk = Join-Path $BuildRoot 'base.apk'
$UnalignedApk = Join-Path $BuildRoot 'unsigned-unaligned.apk'
$AlignedApk = Join-Path $BuildRoot 'unsigned-aligned.apk'
$AndroidUserDir = Join-Path $env:USERPROFILE '.android'
$KeyStore = Join-Path $AndroidUserDir 'debug.keystore'
$FinalApkStage = Join-Path $StageDistRoot 'caishen-ji-android-floating-pet-debug.apk'
$ChinesePrefix = (-join ([char[]](0x8D22, 0x795E, 0x9E21)))
$ChineseSuffix = (-join ([char[]](0x60AC, 0x6D6E, 0x5BA0, 0x7269)))
$FinalApk = Join-Path $DistRoot ($ChinesePrefix + 'Android' + $ChineseSuffix + '-v2.0.0-debug.apk')

$PetManifest = Get-Content -Raw (Join-Path $AppRoot 'assets\pet.json') | ConvertFrom-Json
if ($PetManifest.id -ne 'caishen-ji' -or $PetManifest.spriteVersionNumber -ne 2) {
  throw 'pet.json does not identify the 财神鸡 v2 pet.'
}
$ExpectedSpriteSha256 = 'EDCB1279171D730DA7F93B566D201CF957D602F9F7444940F7DCE8B99D213517'
$SpriteSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $AppRoot 'assets\spritesheet.webp')).Hash
if ($SpriteSha256 -ne $ExpectedSpriteSha256) {
  throw "spritesheet.webp hash mismatch: $SpriteSha256"
}

Remove-Item -LiteralPath $BuildRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BuildRoot, $DistRoot, $StageDistRoot, $GeneratedRoot, $ClassesRoot, $DexRoot | Out-Null
Get-ChildItem -LiteralPath $DistRoot -Filter '*.apk' -ErrorAction SilentlyContinue | Remove-Item -Force

& $Aapt2 compile --dir (Join-Path $AppRoot 'res') -o $CompiledResources
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }

& $Aapt2 link `
  -o $BaseApk `
  -I $PlatformJar `
  --manifest (Join-Path $AppRoot 'AndroidManifest.xml') `
  -A (Join-Path $AppRoot 'assets') `
  --java $GeneratedRoot `
  --min-sdk-version 26 `
  --target-sdk-version 33 `
  --version-code 20 `
  --version-name '2.0.0' `
  --auto-add-overlay `
  -R $CompiledResources
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

$JavaFiles = @()
$JavaFiles += Get-ChildItem -LiteralPath (Join-Path $AppRoot 'java') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
$JavaFiles += Get-ChildItem -LiteralPath $GeneratedRoot -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }

& javac.exe -encoding UTF-8 -source 8 -target 8 -classpath $PlatformJar -d $ClassesRoot $JavaFiles
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

& jar.exe cf $ClassesJar -C $ClassesRoot .
if ($LASTEXITCODE -ne 0) { throw 'jar classes failed' }

& $D8 --lib $PlatformJar --min-api 26 --output $DexRoot $ClassesJar
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }

Copy-Item -LiteralPath $BaseApk -Destination $UnalignedApk -Force
& jar.exe uf $UnalignedApk -C $DexRoot classes.dex
if ($LASTEXITCODE -ne 0) { throw 'jar update failed' }

& $Zipalign -p -f 4 $UnalignedApk $AlignedApk
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

if (-not (Test-Path -LiteralPath $KeyStore)) {
  New-Item -ItemType Directory -Force -Path $AndroidUserDir | Out-Null
  & keytool.exe -genkeypair `
    -v `
    -keystore $KeyStore `
    -storepass android `
    -alias androiddebugkey `
    -keypass android `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname 'CN=Android Debug,O=Android,C=US'
  if ($LASTEXITCODE -ne 0) { throw 'debug keystore generation failed' }
}

& $Apksigner sign `
  --ks $KeyStore `
  --ks-pass pass:android `
  --key-pass pass:android `
  --ks-key-alias androiddebugkey `
  --out $FinalApkStage `
  $AlignedApk
if ($LASTEXITCODE -ne 0) { throw 'apksigner sign failed' }

& $Apksigner verify --verbose $FinalApkStage
if ($LASTEXITCODE -ne 0) { throw 'apksigner verify failed' }

Copy-Item -LiteralPath $FinalApkStage -Destination $FinalApk -Force

$Hash = Get-FileHash -LiteralPath $FinalApk -Algorithm SHA256
[pscustomobject]@{
  Apk = $FinalApk
  SizeBytes = (Get-Item -LiteralPath $FinalApk).Length
  SHA256 = $Hash.Hash
} | Format-List
