import { BaseEdge, getStraightPath } from '@xyflow/react';

export default function DependencyEdge({ sourceX, sourceY, targetX, targetY, style }) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const size = 7;
  const backX = midX - Math.cos(angle) * size;
  const backY = midY - Math.sin(angle) * size;
  const sideX = Math.sin(angle) * size * 0.55;
  const sideY = -Math.cos(angle) * size * 0.55;
  const points = `${midX},${midY} ${backX + sideX},${backY + sideY} ${backX - sideX},${backY - sideY}`;

  return (
    <>
      <BaseEdge path={path} style={style} />
      <polygon className="dependency-arrow" points={points} />
    </>
  );
}
