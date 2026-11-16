import { useEffect, useState } from 'react';
import { getPhoto } from '../lib/claim';

export function Thumb({ id, alt }: { id: string; alt: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = '';
    getPhoto(id).then((b) => b && setSrc((url = URL.createObjectURL(b))));
    return () => URL.revokeObjectURL(url);
  }, [id]);
  return src ? <img src={src} alt={alt} /> : <span className="ph" aria-hidden />;
}
