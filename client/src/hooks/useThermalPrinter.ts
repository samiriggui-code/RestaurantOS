import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const THERMAL_PRINTER_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x0416, productId: 0x5011 }, // Bixolon
  { vendorId: 0x04b8, productId: 0x0202 }, // Epson
  { vendorId: 0x0483, productId: 0x5743 }, // Star Micronics
  { vendorId: 0x1504, productId: 0x0006 }, // Xprinter
];

export function useThermalPrinter() {
  const [device, setDevice] = useState<USBDevice | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connectPrinter = useCallback(async () => {
    if (!navigator.usb) {
      toast.error('متصفحك لا يدعم WebUSB - استخدم Chrome أو Edge');
      return null;
    }

    setConnecting(true);
    try {
      const selectedDevice = await navigator.usb.requestDevice({
        filters: THERMAL_PRINTER_FILTERS,
      });
      await selectedDevice.open();
      await selectedDevice.selectConfiguration(1);
      await selectedDevice.claimInterface(0);
      setDevice(selectedDevice);
      toast.success('تم الاتصال بالطابعة');
      return selectedDevice;
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.name !== 'NotFoundError') {
        toast.error('فشل الاتصال بالطابعة: ' + e.message);
      }
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const printReceipt = useCallback(
    async (receiptData: string) => {
      if (!device) {
        toast.error('الرجاء الاتصال بطابعة أولاً');
        return false;
      }

      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(receiptData);
        await device.transferOut(1, data as unknown as BufferSource);
        return true;
      } catch (err) {
        toast.error('فشل الطباعة: ' + (err instanceof Error ? err.message : String(err)));
        return false;
      }
    },
    [device]
  );

  const printRaw = useCallback(
    async (data: Uint8Array) => {
      if (!device) {
        toast.error('الرجاء الاتصال بطابعة أولاً');
        return false;
      }

      try {
        await device.transferOut(1, data as unknown as BufferSource);
        return true;
      } catch (err) {
        toast.error('فشل الطباعة: ' + (err instanceof Error ? err.message : String(err)));
        return false;
      }
    },
    [device]
  );

  const disconnectPrinter = useCallback(async () => {
    if (device) {
      try {
        await device.close();
      } catch {
        /* ignore */
      }
      setDevice(null);
    }
  }, [device]);

  return {
    device,
    connecting,
    connectPrinter,
    printReceipt,
    printRaw,
    disconnectPrinter,
    isSupported: !!navigator.usb,
  };
}
