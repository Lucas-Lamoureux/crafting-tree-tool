import { BaseEdge } from '@xyflow/react';

const ROUTE_GAP = 14;

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function simplify(points) {
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const previous = points[index - 1];
    const next = points[index + 1];
    return !((previous.x === point.x && point.x === next.x)
      || (previous.y === point.y && point.y === next.y));
  });
}

function segmentHitsObstacle(start, end, obstacle) {
  const left = obstacle.x - ROUTE_GAP;
  const right = obstacle.x + obstacle.width + ROUTE_GAP;
  const top = obstacle.y - ROUTE_GAP;
  const bottom = obstacle.y + obstacle.height + ROUTE_GAP;

  if (start.x === end.x) {
    return start.x > left && start.x < right
      && Math.max(start.y, end.y) > top
      && Math.min(start.y, end.y) < bottom;
  }

  return start.y > top && start.y < bottom
    && Math.max(start.x, end.x) > left
    && Math.min(start.x, end.x) < right;
}

function routeIsClear(points, obstacles) {
  return points.slice(1).every((point, index) => {
    const start = points[index];
    return obstacles.every((obstacle) => !segmentHitsObstacle(start, point, obstacle));
  });
}

function routeLength(points) {
  return points.slice(1).reduce(
    (total, point, index) => total + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y),
    0,
  );
}

function makeCandidates(source, target, obstacles) {
  const xs = new Set([source.x, target.x]);
  const ys = new Set([source.y, target.y]);

  obstacles.forEach((obstacle) => {
    xs.add(obstacle.x - ROUTE_GAP);
    xs.add(obstacle.x + obstacle.width + ROUTE_GAP);
    ys.add(obstacle.y - ROUTE_GAP);
    ys.add(obstacle.y + obstacle.height + ROUTE_GAP);
  });

  const candidates = [
    [source, { x: target.x, y: source.y }, target],
    [source, { x: source.x, y: target.y }, target],
  ];

  xs.forEach((x) => {
    ys.forEach((y) => {
      candidates.push([source, { x, y: source.y }, { x, y }, { x: target.x, y }, target]);
      candidates.push([source, { x: source.x, y }, { x, y }, { x: target.x, y }, target]);
    });
  });

  return candidates.map(simplify).filter((points, index, all) => (
    points.every((point, pointIndex) => pointIndex === 0 || pointKey(point) !== pointKey(points[pointIndex - 1]))
      && all.findIndex((candidate) => candidate.map(pointKey).join('|') === points.map(pointKey).join('|')) === index
  ));
}

function getOrthogonalRoute(source, target, obstacles) {
  const valid = makeCandidates(source, target, obstacles).filter((points) => routeIsClear(points, obstacles));
  return (valid.length > 0 ? valid : [[source, { x: target.x, y: source.y }, target]])
    .sort((a, b) => routeLength(a) - routeLength(b))[0];
}

function getPath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function getArrow(points) {
  const total = routeLength(points);
  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (travelled + length >= total / 2) {
      const distance = total / 2 - travelled;
      const direction = length === 0 ? 1 : distance / length;
      return {
        x: start.x + (end.x - start.x) * direction,
        y: start.y + (end.y - start.y) * direction,
        angle: Math.atan2(end.y - start.y, end.x - start.x),
      };
    }
    travelled += length;
  }

  return { ...points[0], angle: 0 };
}

export default function DependencyEdge({ sourceX, sourceY, targetX, targetY, source, target, style, data }) {
  const obstacles = (data?.obstacles ?? [])
    .filter((node) => node.id !== source && node.id !== target && node.type !== 'boundary')
    .map((node) => ({
      x: node.position?.x ?? 0,
      y: node.position?.y ?? 0,
      width: node.measured?.width ?? node.width ?? 55,
      height: node.measured?.height ?? node.height ?? 32,
    }));
  const points = getOrthogonalRoute({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, obstacles);
  const path = getPath(points);
  const arrow = getArrow(points);
  const size = 7;
  const backX = arrow.x - Math.cos(arrow.angle) * size;
  const backY = arrow.y - Math.sin(arrow.angle) * size;
  const sideX = Math.sin(arrow.angle) * size * 0.55;
  const sideY = -Math.cos(arrow.angle) * size * 0.55;
  const arrowPoints = `${arrow.x},${arrow.y} ${backX + sideX},${backY + sideY} ${backX - sideX},${backY - sideY}`;

  return (
    <>
      <BaseEdge path={path} style={style} />
      <polygon className="dependency-arrow" points={arrowPoints} style={{ fill: style?.stroke ?? '#9ab0a8' }} />
    </>
  );
}
