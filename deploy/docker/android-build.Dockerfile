# Build APK SUNMI / KDS sans Android Studio (sur VPS ou PC avec Docker)
FROM mingc/android-build-box:latest

ARG OPS_HOST=https://pizza-app.gsms-security.com
ARG PUBLIC_HOST=https://pizza.gsms-security.com

WORKDIR /workspace
COPY android/ ./android/
WORKDIR /workspace/android

RUN gradle assemblePosSunmiRelease assemblePosTabletRelease assembleKdsRelease assembleLivreurRelease \
  -POPS_HOST="${OPS_HOST}" \
  -PPUBLIC_HOST="${PUBLIC_HOST}" \
  --no-daemon --stacktrace

RUN mkdir -p /dist && \
  cp app/build/outputs/apk/posSunmi/release/app-posSunmi-release.apk /dist/pos-sunmi.apk && \
  cp app/build/outputs/apk/posTablet/release/app-posTablet-release.apk /dist/pos-tablet.apk && \
  cp app/build/outputs/apk/kds/release/app-kds-release.apk /dist/kds.apk && \
  cp app/build/outputs/apk/livreur/release/app-livreur-release.apk /dist/livreur.apk
