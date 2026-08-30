# Android local persistence testing

## Stable Expo Go path over USB

For same-machine smoke testing on a physical Android device, connect and
authorize the device over USB, then run:

~~~powershell
npm.cmd run android:usb
~~~

The script finds ADB, selects the single authorized device, configures
`adb reverse` for port `8082`, and makes Expo advertise the USB-forwarded
loopback address. Keep Metro running and press `a` in the Expo terminal to
open the project at `exp://127.0.0.1:8082`.

The Android SDK and packager settings used by the script are process-local. It
does not edit machine, repository, or production environment configuration.

If more than one device is connected, select one explicitly:

~~~powershell
npm.cmd run android:usb -- -DeviceSerial <serial>
~~~

This path removes LAN address changes from the test. Stopping Metro means
Expo Go cannot reopen the development bundle; that is a launch/connectivity
failure and does not delete the SQLite database or document files.

## Expo Go identity and storage boundaries

Expo Go is suitable for repeated persistence checks only while all of these
remain true:

- the project is launched from the same development-machine Expo identity;
- the manifest `scopeKey` is unchanged;
- Expo Go app data has not been cleared and Expo Go has not been uninstalled;
- Metro remains available when the development bundle is reopened.

Changing only the LAN IP or using USB localhost forwarding does not change the
manifest `scopeKey` when the same Expo CLI identity and project slug are used.
This repository is not linked to an EAS project, though, so Expo Go assigns an
anonymous scope. That anonymous identity can differ on another development
machine or after the Expo CLI global identity is reset.

On Android in Expo Go, the two local stores have different boundaries:

- `picchuspot-mobile.db` is opened from Expo Go's SQLite directory;
- imported copies live under the experience-scoped `Paths.document` directory,
  in `picchuspot/shoots/<shoot-id>`;
- SQLite stores the absolute document URI for each owned image.

If the anonymous scope changes, the new experience receives a different
document directory. Existing files are not migrated to it, so that situation
must not be treated as an application persistence regression.

## Verification checklist

Use a uniquely named test Shoot and a known non-sensitive image:

1. Create the Shoot and import the image.
2. Return to Shoots, then reopen the Shoot.
3. Reload JavaScript from the Expo Go developer menu.
4. Fully close Expo Go while Metro remains running.
5. Reopen the same `exp://127.0.0.1:8082` project.
6. Confirm the Shoot and image are still present.
7. Delete the test Shoot and confirm only its PicchuSpot-owned copy is removed.

## When a development build is required

Use Expo Go only for same-scope smoke tests. A development build is required
before treating persistence as representative of the installed PicchuSpot app,
or when testing across development machines. The development-build follow-up
must first choose stable native identifiers (`android.package` and
`ios.bundleIdentifier`), then install the SDK 57 `expo-dev-client` package and
build the app for the device. Do not invent or change those product identifiers
as part of a persistence test.

References:

- [Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Expo SDK 57 FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)
- [Expo SDK 57 Constants](https://docs.expo.dev/versions/v57.0.0/sdk/constants/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
