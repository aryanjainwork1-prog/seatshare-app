export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (picked: PickedLocation) => void;
  initialLat?: number;
  initialLng?: number;
  title: string;
  pinColor: string;
}

export function MapPickerModal(_props: MapPickerModalProps) {
  return null;
}
