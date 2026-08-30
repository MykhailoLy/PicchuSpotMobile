import {
  CameraView,
  type CameraMountError,
} from 'expo-camera';
import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

type QuickCameraPreviewProps = {
  cameraKey: number;
  cameraRef: RefObject<CameraView | null>;
  isLandscape: boolean;
  isLeaving: boolean;
  onCameraReady: () => void;
  onMountError: (event: CameraMountError) => void;
  zoom: number;
};

export function QuickCameraPreview({
  cameraKey,
  cameraRef,
  isLandscape,
  isLeaving,
  onCameraReady,
  onMountError,
  zoom,
}: QuickCameraPreviewProps) {
  return (
    <View
      style={[
        styles.previewStage,
        isLandscape
          ? styles.previewStageLandscape
          : styles.previewStagePortrait,
      ]}
    >
      <View
        style={[
          styles.cameraPreviewFrame,
          isLandscape
            ? styles.cameraPreviewFrameLandscape
            : styles.cameraPreviewFramePortrait,
        ]}
      >
        {!isLeaving && (
          <CameraView
            key={cameraKey}
            ref={cameraRef}
            facing="back"
            flash="off"
            mode="picture"
            onCameraReady={onCameraReady}
            onMountError={onMountError}
            responsiveOrientationWhenOrientationLocked
            style={styles.cameraPreview}
            zoom={zoom}
          />
        )}

        <View pointerEvents="none" style={styles.grid}>
          <View style={[styles.verticalGridLine, styles.verticalGridThird]} />
          <View
            style={[styles.verticalGridLine, styles.verticalGridTwoThirds]}
          />
          <View style={[styles.horizontalGridLine, styles.horizontalGridThird]} />
          <View
            style={[styles.horizontalGridLine, styles.horizontalGridTwoThirds]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraPreview: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cameraPreviewFrame: {
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  cameraPreviewFramePortrait: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  cameraPreviewFrameLandscape: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  previewStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  previewStagePortrait: {
    width: '100%',
  },
  previewStageLandscape: {
    minWidth: 0,
  },
  grid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  verticalGridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.46)',
  },
  horizontalGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.46)',
  },
  verticalGridThird: {
    left: '33.333%',
  },
  verticalGridTwoThirds: {
    left: '66.666%',
  },
  horizontalGridThird: {
    top: '33.333%',
  },
  horizontalGridTwoThirds: {
    top: '66.666%',
  },
});
