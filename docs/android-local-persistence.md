# Android development-build and local persistence testing

PicchuSpot Android testing uses the project-specific development build, not
Expo Go. Its application ID is `com.picchuspot.app`, so SQLite and document
storage live in PicchuSpot's own installed-app sandbox.

## Prerequisites on Windows

Install Android Studio with the SDK Platform and SDK Build-Tools required by
Expo SDK 57, install OpenJDK 17, then enable USB debugging on the Android
device. From PowerShell, make the local SDK and JDK available to the current
session. The paths below cover the standard per-user SDK and Microsoft OpenJDK
locations; adjust them if those tools use custom directories.

~~~powershell
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$androidJdk = Get-ChildItem "$env:ProgramFiles\Microsoft" -Directory -Filter 'jdk-17*' |
  Sort-Object Name -Descending |
  Select-Object -First 1 -ExpandProperty FullName
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:JAVA_HOME = $androidJdk
$env:Path = "$androidSdk\platform-tools;$androidJdk\bin;$env:Path"
adb devices -l
~~~

The device must be listed with state `device`. Unlock the phone and accept its
USB debugging prompt if it is `unauthorized`.

## First compile and install

Install JavaScript dependencies, connect one authorized device, then let Expo
generate the ignored native project, compile it locally and install the debug
APK:

~~~powershell
npm.cmd install
npx.cmd expo run:android --device
~~~

Choose the physical device when prompted. No Expo account or EAS configuration
is required for this local build. The generated `android/` directory is a local
CNG artifact and remains ignored; native identifiers and other durable native
settings belong in `app.json` or Expo config plugins.

Rebuild after installing or updating a native dependency, changing `app.json`
native configuration, or upgrading Expo. To guarantee a clean regeneration:

~~~powershell
npx.cmd expo prebuild --clean --platform android
npx.cmd expo run:android --device
~~~

Do not use `prebuild --clean` when uncommitted manual native work exists; it
replaces the generated native directory.

If Gradle reports `Unable to establish loopback connection` only inside a
hosted Windows terminal, give that build process a short native temp path and
retry. This works around the Windows JVM socket-path limit without changing the
project:

~~~powershell
New-Item -ItemType Directory -Path 'C:\jtmp' -Force | Out-Null
$env:TEMP = 'C:\jtmp'
$env:TMP = 'C:\jtmp'
npx.cmd expo run:android --device
~~~

## Daily USB development

Once the development build is installed, connect and authorize the device over
USB, then run:

~~~powershell
npm.cmd run android:usb
~~~

The helper finds ADB, selects the single authorized device, configures
`adb reverse` for port `8082`, and starts Metro in development-client mode on
the USB-forwarded loopback address. Keep Metro running and press `a` in the Expo
terminal to open the installed PicchuSpot app.

The Android SDK and packager settings used by the helper are process-local. It
does not edit machine, repository or production environment configuration.

If more than one device is connected, select one explicitly:

~~~powershell
npm.cmd run android:usb -- -DeviceSerial <serial>
~~~

Stopping Metro prevents the development build from loading its JavaScript
bundle. That is a development-server connectivity failure and does not delete
the SQLite database or document files.

## Development-build storage boundary

The installed development build starts with a different Android application
sandbox from Expo Go. Existing Expo Go test data is not expected to migrate.

Inside the installed PicchuSpot app:

- `picchuspot-mobile.db` is the single source of truth for Shoot and media
  metadata;
- imported copies live under the app-scoped `Paths.document` directory in
  `picchuspot/shoots/<shoot-id>`;
- SQLite stores the absolute document URI for each PicchuSpot-owned image;
- uninstalling PicchuSpot or clearing its Android app data removes this local
  sandbox.

Recompiling and reinstalling the debug APK normally preserves app data because
the application ID and signing key are unchanged. Do not uninstall the app or
clear its data during persistence verification.

## Physical-device acceptance checklist

Use a uniquely named test Shoot and a known non-sensitive image:

1. Confirm the installed app label is **PicchuSpot**.
2. Open **Shoots**, **Orders** and **Account** and confirm each tab renders.
3. Create the test Shoot and import the image.
4. Return to Shoots, reopen the Shoot and confirm the image is present.
5. Rename the Shoot, return to Shoots and reopen the renamed Shoot.
6. Reload JavaScript from the development menu and confirm the Shoot and image
   remain present.
7. Force-stop PicchuSpot, restart Metro, reconnect USB, launch PicchuSpot from
   the Home screen and confirm the Shoot and image remain present.
8. Disconnect and reconnect the device, restore `adb reverse` with
   `npm.cmd run android:usb`, and confirm the Shoot remains present.
9. Remove the imported photo and confirm the Shoot remains with zero photos.
10. Delete the test Shoot and confirm it no longer appears in Shoots. The app
    must delete only its owned copy; the original imported image remains.

For Quick camera testing, deny and recover camera permission once, take repeated
portrait and landscape photos, then repeat steps 7 through 10 for the captured
files. The development build intentionally saves camera output only inside the
same Shoot-owned document directory; it does not export to the system Gallery.

References:

- [Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Expo SDK 57 FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)
- [Expo SDK 57 DevClient](https://docs.expo.dev/versions/v57.0.0/sdk/dev-client/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo local app development](https://docs.expo.dev/guides/local-app-development/)
- [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
