import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isSpeaking }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- Configuration ---
    const particleCount = 120;
    const connectionDistance = 45;
    const baseRadius = 110;

    // --- State Variables ---
    let time = 0;
    let rotationX = 0;
    let rotationY = 0;
    let pulseIntensity = 0;

    // --- Particle System ---
    interface Particle {
      theta: number; // Angle 1
      phi: number;   // Angle 2
      rBase: number; // Base radius
      size: number;
      speed: number;
      phase: number; // For individual movement
    }

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos((Math.random() * 2) - 1),
        rBase: baseRadius * (0.8 + Math.random() * 0.4),
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2
      });
    }

    const draw = () => {
      // 1. Clear Canvas (Transparent)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // 2. Update Physics
      const baseSpeed = isActive ? 0.005 : 0.001;
      const speedMult = isSpeaking ? 4 : 1;
      
      rotationX += baseSpeed * speedMult;
      rotationY += baseSpeed * 0.8 * speedMult;
      time += 0.05;

      // Pulse logic for speech: smoothly transition intensity
      const targetPulse = isSpeaking ? 0.35 : 0.05;
      pulseIntensity += (targetPulse - pulseIntensity) * 0.1;

      // 3. Colors
      // Define base RGB values
      let r, g, b;
      if (isActive) {
        if (isSpeaking) {
          // Active Speaking: Cyan-400 (34, 211, 238)
          r = 34; g = 211; b = 238;
        } else {
          // Active Listening: Violet-400 (167, 139, 250)
          r = 167; g = 139; b = 250;
        }
      } else {
        // Offline: Slate-500 (100, 116, 139)
        r = 100; g = 116; b = 139;
      }

      const colorString = `${r}, ${g}, ${b}`;

      // 4. Draw Core Atmosphere (Glow)
      // Layered gradients for volumetric look
      const glowSize = 70 + (Math.sin(time * 0.1) * 10) + (pulseIntensity * 120);
      const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, glowSize * 2);
      
      gradient.addColorStop(0, `rgba(${colorString}, ${isActive ? 0.8 : 0.2})`);
      gradient.addColorStop(0.3, `rgba(${colorString}, ${isActive ? 0.3 : 0.1})`);
      gradient.addColorStop(0.6, `rgba(${colorString}, ${isActive ? 0.05 : 0.01})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize * 3, 0, Math.PI * 2);
      ctx.fill();

      // 5. Calculate Particle Positions (3D -> 2D)
      const points: {x: number, y: number, z: number, alpha: number}[] = [];

      particles.forEach(p => {
        // Dynamic Radius: Breathing effect + Speech burst
        // Particles expand outward when speaking
        const breathing = Math.sin(time * 2 + p.phase) * 5;
        const speechExpansion = pulseIntensity * 40 * Math.sin(p.phase * 3);
        const rCurrent = p.rBase + breathing + speechExpansion;

        // Spherical to Cartesian Coordinates
        let x = rCurrent * Math.sin(p.phi) * Math.cos(p.theta);
        let y = rCurrent * Math.sin(p.phi) * Math.sin(p.theta);
        let z = rCurrent * Math.cos(p.phi);

        // 3D Rotation Matrix
        // Rotate around Y axis
        let x1 = x * Math.cos(rotationY) - z * Math.sin(rotationY);
        let z1 = x * Math.sin(rotationY) + z * Math.cos(rotationY);
        
        // Rotate around X axis
        let y2 = y * Math.cos(rotationX) - z1 * Math.sin(rotationX);
        let z2 = y * Math.sin(rotationX) + z1 * Math.cos(rotationX);

        // Perspective Projection
        const fov = 350;
        const scale = fov / (fov + z2);
        
        const x2D = cx + x1 * scale;
        const y2D = cy + y2 * scale;

        // Check if particle is in front of camera (roughly)
        if (scale > 0) {
            points.push({
                x: x2D,
                y: y2D,
                z: z2,
                alpha: Math.min(1, Math.max(0.1, (scale - 0.4) + (pulseIntensity * 0.5)))
            });
        }
      });

      // 6. Draw Neural Connections (Lines between close particles)
      if (isActive) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${colorString}, ${0.15 + pulseIntensity * 0.3})`;
          ctx.lineWidth = 0.5 + pulseIntensity; // Thicker lines when speaking

          for (let i = 0; i < points.length; i++) {
              // Optimization: Don't check every single pair against every other, but close enough for visual effect
              // Checking adjacent indices in sorted/unsorted array creates random-looking valid web
              for (let j = i + 1; j < points.length; j++) {
                  const p1 = points[i];
                  const p2 = points[j];
                  
                  // Optimization: Fast reject using Manhattan distance
                  if (Math.abs(p1.x - p2.x) > connectionDistance) continue;
                  if (Math.abs(p1.y - p2.y) > connectionDistance) continue;

                  const dx = p1.x - p2.x;
                  const dy = p1.y - p2.y;
                  const dist = Math.sqrt(dx*dx + dy*dy);

                  if (dist < connectionDistance) {
                      ctx.moveTo(p1.x, p1.y);
                      ctx.lineTo(p2.x, p2.y);
                  }
              }
          }
          ctx.stroke();
      }

      // 7. Draw Particles
      points.forEach(p => {
          ctx.beginPath();
          ctx.fillStyle = `rgba(${colorString}, ${p.alpha})`;
          // Size scales with perspective and pulse
          const size = (1.5 + (p.alpha * 2)) * (1 + pulseIntensity);
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
      });
      
      // 8. Draw Orbital Rings (Decorative Gyroscope)
      if (isActive) {
         ctx.strokeStyle = `rgba(${colorString}, ${0.2 + pulseIntensity * 0.2})`;
         ctx.lineWidth = 1 + pulseIntensity;
         
         const ringSize = baseRadius * 1.5 + (pulseIntensity * 30);
         
         // Outer Ring 1 (Rotating Counter-Clockwise)
         ctx.save();
         ctx.translate(cx, cy);
         ctx.rotate(-rotationX * 0.5);
         ctx.beginPath();
         // Draw elliptical orbit
         ctx.ellipse(0, 0, ringSize, ringSize * 0.3, 0, 0, Math.PI * 2);
         ctx.stroke();
         ctx.restore();

         // Outer Ring 2 (Rotating Clockwise)
         ctx.save();
         ctx.translate(cx, cy);
         ctx.rotate(rotationY * 0.6 + Math.PI/3);
         ctx.beginPath();
         ctx.ellipse(0, 0, ringSize * 0.9, ringSize * 0.25, 0, 0, Math.PI * 2);
         ctx.stroke();
         ctx.restore();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive, isSpeaking]);

  return (
    <div className="relative w-full h-[500px] flex items-center justify-center">
        <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="w-full h-full object-contain"
        />
    </div>
  );
};

export default Visualizer;