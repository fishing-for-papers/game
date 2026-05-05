type LoadingOverlayProps = {
	isLoading: boolean
	backgroundColor?: string
	text?: string
}

function LoadingOverlay({
	isLoading,
	backgroundColor = '#b9dbea',
	text = 'Loading…',
}: LoadingOverlayProps) {
	if (!isLoading) return null

	return (
		<div
			className="absolute inset-0 z-10 flex flex-col items-center justify-center text-slate-700"
			style={{ backgroundColor }}
		>
			<div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700/30 border-t-slate-700" />
			<p className="mt-4 text-lg font-semibold">{text}</p>
		</div>
	)
}

export default LoadingOverlay
