[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8082,

  [string]$DeviceSerial = $env:ANDROID_SERIAL
)

$ErrorActionPreference = 'Stop'

function Resolve-AdbPath {
  $adbCommand = Get-Command adb.exe -ErrorAction SilentlyContinue

  if ($adbCommand) {
    return $adbCommand.Source
  }

  $sdkRoots = @(
    $env:ANDROID_SDK_ROOT,
    $env:ANDROID_HOME,
    $(if ($env:LOCALAPPDATA) {
      Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    }),
    'C:\Android\Sdk'
  ) | Where-Object { $_ }

  foreach ($sdkRoot in $sdkRoots) {
    $candidate = Join-Path $sdkRoot 'platform-tools\adb.exe'

    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return $candidate
    }
  }

  throw 'ADB was not found. Install Android SDK Platform-Tools or set ANDROID_SDK_ROOT.'
}

$adbPath = Resolve-AdbPath
$deviceOutput = & $adbPath devices -l

if ($LASTEXITCODE -ne 0) {
  throw 'ADB could not list connected devices.'
}

$authorizedDevices = @(
  foreach ($line in $deviceOutput) {
    if ($line -match '^(\S+)\s+device(?:\s|$)') {
      $Matches[1]
    }
  }
)

if ($DeviceSerial) {
  if ($DeviceSerial -notin $authorizedDevices) {
    throw "Android device '$DeviceSerial' is not connected and authorized."
  }

  $selectedDevice = $DeviceSerial
} elseif ($authorizedDevices.Count -eq 1) {
  $selectedDevice = $authorizedDevices[0]
} elseif ($authorizedDevices.Count -eq 0) {
  throw 'No connected, authorized Android device was found.'
} else {
  throw 'More than one Android device is connected. Pass -DeviceSerial after npm run android:usb --.'
}

& $adbPath -s $selectedDevice reverse "tcp:$Port" "tcp:$Port" | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw "ADB reverse failed for device '$selectedDevice'."
}

$platformToolsDirectory = Split-Path -Parent $adbPath
$androidSdkDirectory = Split-Path -Parent $platformToolsDirectory
$env:Path = "$platformToolsDirectory;$env:Path"
$env:ANDROID_HOME = $androidSdkDirectory
$env:ANDROID_SDK_ROOT = $androidSdkDirectory
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'

Write-Host "USB forwarding is active for $selectedDevice on port $Port."
Write-Host "Keep Metro running, then press 'a' to open the installed PicchuSpot development build."
Write-Host 'Stopping Metro prevents the development build from loading JavaScript, but does not delete local data.'

& npx.cmd expo start --dev-client --lan --port $Port

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
