import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import BackButton from '../components/BackButton'
import VenuePondPreview from '../components/VenuePondPreview'
import { usePaperStore, VENUES, type Venue } from '../stores/usePaperStore'
import { environmentLandColor } from '../config/contourConfig'
import { createVariableWidthPath } from '../utils/variableWidthPath'

type MapSceneProps = {
	onNavigate: (target: 'start' | 'pond' | 'map' | 'gallery') => void
}

type PondNode = {
	id: Venue
	paperCount: number
	x?: number
	y?: number
	fx?: number | null
	fy?: number | null
}

type RoadEdge = {
	source: Venue | PondNode
	target: Venue | PondNode
}

function MapScene({ onNavigate }: MapSceneProps) {
	const setSelectedVenue = usePaperStore((state) => state.setSelectedVenue)
	const containerRef = useRef<HTMLDivElement>(null)
	const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
	const [nodes, setNodes] = useState<PondNode[]>([])
	const [edges, setEdges] = useState<RoadEdge[]>([])
	const [venuePaperCounts, setVenuePaperCounts] = useState<Record<Venue, number>>({} as Record<Venue, number>)

	// Load paper counts for all venues on mount
	useEffect(() => {
		const loadPaperCounts = async () => {
			const counts: Record<Venue, number> = {} as Record<Venue, number>
			
			for (const venue of VENUES) {
				try {
					const papersModule = await import(`../assets/papers/${venue}.json`)
					const papers = papersModule.default as any[]
					counts[venue] = papers.length
				} catch (error) {
					console.error(`Failed to load papers for ${venue}:`, error)
					counts[venue] = 0
				}
			}
			
			setVenuePaperCounts(counts)
		}

		loadPaperCounts()
	}, [])

	// Update dimensions on mount and resize
	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				setDimensions({
					width: containerRef.current.offsetWidth,
					height: containerRef.current.offsetHeight
				})
			}
		}
		updateDimensions()
		window.addEventListener('resize', updateDimensions)
		return () => window.removeEventListener('resize', updateDimensions)
	}, [])

	// Initialize force-directed layout when dimensions or paper counts change
	useEffect(() => {
		if (dimensions.width <= 0 || dimensions.height <= 0) return
		if (Object.keys(venuePaperCounts).length === 0) return // Wait for paper counts

		// Calculate max paper count for scaling
		const maxPaperCount = Math.max(...Object.values(venuePaperCounts))
		const minPaperCount = Math.min(...Object.values(venuePaperCounts))
		
		// Define size range for ponds (250-500px)
		const minSize = 250
		const maxSize = 500
		
		// Helper to calculate pond size based on paper count
		const getPondSize = (count: number) => {
			if (maxPaperCount === minPaperCount) return (minSize + maxSize) / 2
			const ratio = (count - minPaperCount) / (maxPaperCount - minPaperCount)
			return minSize + ratio * (maxSize - minSize)
		}

		// Create nodes for all venues with paper counts
		const initialNodes: PondNode[] = VENUES.map((venue) => ({
			id: venue,
			paperCount: venuePaperCounts[venue] || 0
		}))

		// Create edges - connect venues in a way that creates an interesting map
		// Strategy: create a connected graph by linking each venue to 2-3 others
		const initialEdges: RoadEdge[] = []
		const venueList = [...VENUES]
		
		// Create a ring structure first (ensures connectivity)
		for (let i = 0; i < venueList.length; i++) {
			initialEdges.push({
				source: venueList[i],
				target: venueList[(i + 1) % venueList.length]
			})
		}
		
		// Add some cross-connections for visual interest (if we have 3+ venues)
		if (venueList.length >= 3) {
			for (let i = 0; i < venueList.length; i++) {
				// Connect to venue 2 steps away
				if (venueList.length > 3 || i === 0) { // For exactly 3, only add one cross-connection
					const targetIdx = (i + 2) % venueList.length
					// Only add if not already connected
					const alreadyExists = initialEdges.some(
						e => (e.source === venueList[i] && e.target === venueList[targetIdx]) ||
						     (e.source === venueList[targetIdx] && e.target === venueList[i])
					)
					if (!alreadyExists && i < Math.floor(venueList.length / 2)) {
						initialEdges.push({
							source: venueList[i],
							target: venueList[targetIdx]
						})
					}
				}
			}
		}

		// Create force simulation with increased spacing and horizontal spread
		const simulation = d3.forceSimulation<PondNode>(initialNodes)
			.force('link', d3.forceLink<PondNode, RoadEdge>(initialEdges)
				.id(d => d.id)
				.distance(800) // Further increased for more spread
				.strength(0.3) // Reduced strength for more flexibility
			)
			.force('charge', d3.forceManyBody().strength(-8000)) // Strong repulsion for maximum spread
			.force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.05)) // Weak center to allow spread
			.force('collision', d3.forceCollide<PondNode>().radius((d) => getPondSize(d.paperCount) / 2 + 80)) // More padding between ponds
			.force('x', d3.forceX(dimensions.width / 2).strength(0.2)) // Very weak horizontal to allow spread
			.force('y', d3.forceY(dimensions.height / 2).strength(0.5)) // Strong vertical to constrain and encourage horizontal spread

		// Run simulation
		simulation.on('tick', () => {
			setNodes([...initialNodes])
		})

		// Let it run for a bit then stop
		simulation.tick(300)
		simulation.stop()

		setNodes(initialNodes)
		setEdges(initialEdges)

		return () => {
			simulation.stop()
		}
	}, [dimensions, venuePaperCounts])

	const handleVenueSelect = (venue: Venue) => {
		setSelectedVenue(venue)
		onNavigate('pond')
	}

	// Helper to calculate pond size based on paper count
	const getPondSize = (paperCount: number) => {
		if (Object.keys(venuePaperCounts).length === 0) return 350
		
		const maxPaperCount = Math.max(...Object.values(venuePaperCounts))
		const minPaperCount = Math.min(...Object.values(venuePaperCounts))
		
		const minSize = 250
		const maxSize = 500
		
		if (maxPaperCount === minPaperCount) return (minSize + maxSize) / 2
		const ratio = (paperCount - minPaperCount) / (maxPaperCount - minPaperCount)
		return minSize + ratio * (maxSize - minSize)
	}

	// Helper to get node position in pixels
	const getNodePosition = (venue: Venue) => {
		const node = nodes.find(n => n.id === venue)
		if (!node || node.x === undefined || node.y === undefined) {
			return { x: dimensions.width / 2, y: dimensions.height / 2 }
		}
		return { x: node.x, y: node.y }
	}

	// Generate curved path between two points (gap based on actual pond radius)
	const generateRoadPath = (edge: RoadEdge): string => {
		const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
		const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id
		
		const start = getNodePosition(sourceId)
		const end = getNodePosition(targetId)
		
		// Get node sizes to determine gap
		const sourceNode = nodes.find(n => n.id === sourceId)
		const targetNode = nodes.find(n => n.id === targetId)
		
		if (!sourceNode || !targetNode) return ''
		
		const sourceSize = getPondSize(sourceNode.paperCount)
		const targetSize = getPondSize(targetNode.paperCount)
		
		// Calculate actual radii (adding small padding)
		const sourceRadius = sourceSize / 2 + 30
		const targetRadius = targetSize / 2 + 30
		
		// Calculate control point for quadratic curve (offset perpendicular to line)
		const midX = (start.x + end.x) / 2
		const midY = (start.y + end.y) / 2
		
		// Perpendicular offset for curve
		const dx = end.x - start.x
		const dy = end.y - start.y
		const totalDist = Math.sqrt(dx * dx + dy * dy)
		if (totalDist === 0) return ''
		
		const perpX = -dy / totalDist
		const perpY = dx / totalDist
		
		// Offset distance (creates curve bow)
		const offset = totalDist * 0.15
		const controlX = midX + perpX * offset
		const controlY = midY + perpY * offset
		
		// Helper function to get point on quadratic Bezier curve
		const getPointOnCurve = (t: number) => {
			const mt = 1 - t
			return {
				x: mt * mt * start.x + 2 * mt * t * controlX + t * t * end.x,
				y: mt * mt * start.y + 2 * mt * t * controlY + t * t * end.y
			}
		}
		
		// Helper to get distance from start point to point at parameter t
		const getDistanceFromStart = (t: number) => {
			const point = getPointOnCurve(t)
			const distX = point.x - start.x
			const distY = point.y - start.y
			return Math.sqrt(distX * distX + distY * distY)
		}
		
		const getDistanceFromEnd = (t: number) => {
			const point = getPointOnCurve(t)
			const distX = point.x - end.x
			const distY = point.y - end.y
			return Math.sqrt(distX * distX + distY * distY)
		}
		
		// Find t values where path exits source pond and enters target pond
		// Use binary search for accuracy
		const findTForDistance = (targetDist: number, fromStart: boolean, minT: number, maxT: number): number => {
			let low = minT
			let high = maxT
			const getDistance = fromStart ? getDistanceFromStart : getDistanceFromEnd
			
			for (let i = 0; i < 20; i++) { // 20 iterations gives good precision
				const mid = (low + high) / 2
				const dist = getDistance(mid)
				
				if (Math.abs(dist - targetDist) < 1) return mid
				
				if (fromStart) {
					if (dist < targetDist) low = mid
					else high = mid
				} else {
					if (dist < targetDist) high = mid
					else low = mid
				}
			}
			return (low + high) / 2
		}
		
		const startT = findTForDistance(sourceRadius, true, 0, 0.5)
		const endT = findTForDistance(targetRadius, false, 0.5, 1)
		
		const startPoint = getPointOnCurve(startT)
		const endPoint = getPointOnCurve(endT)
		
		// Calculate a control point for the middle section to maintain curve
		const midControl = getPointOnCurve(0.5)
		
		// Draw the path with size-dependent gaps
		return `M ${startPoint.x} ${startPoint.y} Q ${midControl.x} ${midControl.y}, ${endPoint.x} ${endPoint.y}`
	}

	// Generate squiggly road path with hand-drawn effect
	const generateSquigglyRoadPath = (roadPath: string): string => {
		if (!roadPath) return ''
		
		const roadVariableConfig = {
			baseWidth: 3.5,
			widthVariation: 0.5,
			noiseScale: 6,
			samplesPerPixel: 0.1,
			minSamples: 20,
			maxSamples: 100,
		}
		
		return createVariableWidthPath(roadPath, roadVariableConfig)
	}

	return (
		<div
			ref={containerRef}
			className="relative w-full h-full overflow-hidden"
			style={{ backgroundColor: environmentLandColor }}
		>
			<div className="absolute left-6 top-6 z-10 flex gap-3">
				<BackButton target="start" onNavigate={onNavigate} />
				<BackButton target="gallery" onNavigate={onNavigate}>
					Gallery
				</BackButton>
			</div>

			{/* Title */}
			<div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10">
				<h1 className="text-4xl font-bold text-slate-800">Choose Your Pond</h1>
			</div>

			{/* Roads/Paths connecting ponds */}
			<svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
				{/* Roads with hand-drawn effect */}
				{edges.map((edge, idx) => {
					const pathD = generateRoadPath(edge)
					const squigglyPath = generateSquigglyRoadPath(pathD)
					if (!squigglyPath) return null
					
					return (
						<path
							key={`road-${idx}`}
							d={squigglyPath}
							fill="#a3a08a"
							fillOpacity={0.5}
						/>
					)
				})}
			</svg>


			{/* Pond previews positioned like a map */}
			{nodes.map((node) => {
				if (!node.x || !node.y) return null
				const pondSize = getPondSize(node.paperCount)
				return (
					<div
						key={node.id}
						className="absolute"
						style={{
							left: `${node.x}px`,
							top: `${node.y}px`,
							transform: 'translate(-50%, -50%)',
							zIndex: 10,
						}}
					>
						<VenuePondPreview
							venue={node.id}
							onClick={() => handleVenueSelect(node.id)}
							width={pondSize}
							height={pondSize}
						/>
					</div>
				)
			})}

		</div>
	)
}

export default MapScene
