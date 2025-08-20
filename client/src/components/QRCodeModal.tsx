import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, QrCode, Upload, CheckCircle, XCircle } from 'lucide-react';
import jsQR from 'jsqr';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'generate' | 'scan';
  onQRGenerated?: (qrCode: string) => void;
  onQRScanned?: (data: any) => void;
  generationData?: {
    userId: string;
    username: string;
    publicKey: string;
  };
  title?: string;
}

export function QRCodeModal({ 
  isOpen, 
  onClose, 
  mode, 
  onQRGenerated,
  onQRScanned,
  generationData,
  title 
}: QRCodeModalProps) {
  const [qrCode, setQRCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code
  const generateQR = async () => {
    if (!generationData) return;
    
    setIsGenerating(true);
    setError('');
    
    try {
      const response = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generationData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setQRCode(data.qrCode);
        onQRGenerated?.(data.qrCode);
      } else {
        setError(data.error || 'Failed to generate QR code');
      }
    } catch (err) {
      setError('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  // Start camera for QR scanning
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        scanQRCode();
      }
    } catch (err) {
      setError('Failed to access camera');
    }
  };

  // Scan QR code from video
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          handleQRCodeData(code.data);
          stopCamera();
          return;
        }
      }
      
      if (isScanning) {
        requestAnimationFrame(scan);
      }
    };
    
    scan();
  };

  // Handle file upload for QR scanning
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          handleQRCodeData(code.data);
        } else {
          setError('No QR code found in image');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Process QR code data
  const handleQRCodeData = async (data: string) => {
    try {
      const response = await fetch('/api/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData: data })
      });
      
      const result = await response.json();
      setVerificationResult(result);
      onQRScanned?.(result);
    } catch (err) {
      setError('Failed to verify QR code');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Reset modal state
  const handleClose = () => {
    stopCamera();
    setQRCode('');
    setVerificationResult(null);
    setError('');
    onClose();
  };

  React.useEffect(() => {
    if (mode === 'generate' && generationData && isOpen) {
      generateQR();
    }
  }, [mode, generationData, isOpen]);

  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            {title || (mode === 'generate' ? 'Identity Verification QR Code' : 'Scan QR Code')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'generate' && (
            <div className="text-center">
              {isGenerating && (
                <div className="py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Generating QR code...</p>
                </div>
              )}
              
              {qrCode && (
                <div className="space-y-4">
                  <img 
                    src={qrCode} 
                    alt="Verification QR Code" 
                    className="mx-auto border rounded-lg shadow-sm max-w-full" 
                  />
                  <p className="text-sm text-gray-600">
                    Show this QR code to verify your identity in the conversation
                  </p>
                </div>
              )}
            </div>
          )}

          {mode === 'scan' && (
            <div className="space-y-4">
              {!isScanning && !verificationResult && (
                <div className="text-center space-y-4">
                  <Button 
                    onClick={startCamera}
                    className="w-full"
                    variant="outline"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </Button>
                  
                  <div className="text-sm text-gray-500">or</div>
                  
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Image
                  </Button>
                  
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {isScanning && (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg bg-black"
                    style={{ maxHeight: '300px' }}
                  />
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Position the QR code within the camera view
                    </p>
                    <Button onClick={stopCamera} variant="outline">
                      Stop Camera
                    </Button>
                  </div>
                </div>
              )}

              {verificationResult && (
                <div className="text-center space-y-4">
                  {verificationResult.isValid ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="w-6 h-6" />
                      <span className="font-medium">QR Code Verified!</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-red-600">
                      <XCircle className="w-6 h-6" />
                      <span className="font-medium">Invalid QR Code</span>
                    </div>
                  )}
                  
                  {verificationResult.data && (
                    <div className="text-left bg-gray-50 rounded p-3 text-sm">
                      <div><strong>User ID:</strong> {verificationResult.data.userId}</div>
                      <div><strong>Username:</strong> {verificationResult.data.username}</div>
                      <div><strong>Timestamp:</strong> {new Date(verificationResult.data.timestamp).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-center text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={handleClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}