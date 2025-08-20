import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WalkieTalkieProps {
  isEnabled: boolean; // Se entrambi gli utenti sono attivi nella stessa chat
  onAudioData?: (audioData: Blob) => void; // Callback per inviare audio
  className?: string;
}

export function WalkieTalkie({ isEnabled, onAudioData, className }: WalkieTalkieProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // Richiedi permessi audio al mount
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasPermission(true);
        audioStream.current = stream;
        
        // Setup MediaRecorder
        mediaRecorder.current = new MediaRecorder(stream);
        
        mediaRecorder.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data);
          }
        };
        
        mediaRecorder.current.onstop = () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
          if (onAudioData && audioBlob.size > 0) {
            onAudioData(audioBlob);
          }
          audioChunks.current = [];
        };
        
      } catch (error) {
        console.error('Errore accesso microfono:', error);
        setHasPermission(false);
      }
    };

    if (isEnabled) {
      requestPermissions();
    }

    return () => {
      if (audioStream.current) {
        audioStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isEnabled, onAudioData]);

  const startRecording = () => {
    if (!mediaRecorder.current || !hasPermission || !isEnabled) return;
    
    try {
      mediaRecorder.current.start(100); // Registra in chunk da 100ms
      setIsRecording(true);
    } catch (error) {
      console.error('Errore avvio registrazione:', error);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder.current || !isRecording) return;
    
    try {
      mediaRecorder.current.stop();
      setIsRecording(false);
    } catch (error) {
      console.error('Errore stop registrazione:', error);
    }
  };

  const handleMouseDown = () => {
    startRecording();
  };

  const handleMouseUp = () => {
    stopRecording();
  };

  const handleTouchStart = () => {
    startRecording();
  };

  const handleTouchEnd = () => {
    stopRecording();
  };

  if (!isEnabled) {
    return null; // Non mostrare se non abilitato
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="flex items-center space-x-1 bg-muted rounded-full px-3 py-1">
        <Radio className="w-4 h-4 text-blue-500" />
        <span className="text-xs font-medium text-muted-foreground">
          Walkie-Talkie
        </span>
      </div>
      
      <Button
        variant={isRecording ? "destructive" : "outline"}
        size="sm"
        className={cn(
          "transition-all duration-150",
          isRecording && "scale-110 shadow-lg",
          !hasPermission && "opacity-50 cursor-not-allowed"
        )}
        disabled={!hasPermission || !isEnabled}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Stop se il mouse esce dal bottone
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        title={
          !hasPermission ? "Permessi microfono richiesti" :
          isRecording ? "Rilascia per smettere di parlare" :
          "Tieni premuto per parlare"
        }
      >
        {isRecording ? (
          <>
            <Mic className="w-4 h-4 mr-1" />
            <span className="text-xs">Parlando...</span>
          </>
        ) : (
          <>
            <MicOff className="w-4 h-4 mr-1" />
            <span className="text-xs">Tieni premuto</span>
          </>
        )}
      </Button>
      
      {isReceiving && (
        <div className="flex items-center space-x-1 text-green-500">
          <Radio className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-medium">Ricevendo...</span>
        </div>
      )}
    </div>
  );
}

// Hook per gestire la riproduzione audio ricevuto
export function useAudioPlayer() {
  const audioContext = useRef<AudioContext | null>(null);
  
  const playAudioData = async (audioBlob: Blob) => {
    try {
      if (!audioContext.current) {
        audioContext.current = new AudioContext();
      }
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
      
      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      source.start();
      
    } catch (error) {
      console.error('Errore riproduzione audio:', error);
    }
  };
  
  return { playAudioData };
}