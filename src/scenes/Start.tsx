import { useState } from 'react'
import startBackground from '../assets/scenes/start-background.svg'
import StartButton from '../components/StartButton'
import BackButton from '../components/BackButton'
import LoadingOverlay from '../components/LoadingOverlay'
import Modal from '../components/ui/Modal'
import type { GameSessionSummary } from '../utils/gameStorage'

type StartProps = {
	onStartNewGame: () => void
	onResumeGame: (sessionId: string) => void
	onRenameGame: (sessionId: string, newName: string) => void
	onDeleteGame: (sessionId: string) => void
	sessions: GameSessionSummary[]
}

function StartScene({ onStartNewGame, onResumeGame, onRenameGame, onDeleteGame, sessions }: StartProps) {
	const [isLoaded, setIsLoaded] = useState(false)
	const [isResumeModalOpen, setIsResumeModalOpen] = useState(false)
	const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
	const [editingName, setEditingName] = useState('')
	const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
	const [deletingSessionName, setDeletingSessionName] = useState('')

	const formatDate = (timestamp: number): string => {
		return new Date(timestamp).toLocaleString()
	}

	const handleStartRename = (session: GameSessionSummary) => {
		setEditingSessionId(session.id)
		setEditingName(session.name)
	}

	const handleSaveRename = (sessionId: string) => {
		onRenameGame(sessionId, editingName)
		setEditingSessionId(null)
		setEditingName('')
	}

	const handleCancelRename = () => {
		setEditingSessionId(null)
		setEditingName('')
	}

	const handleStartDelete = (session: GameSessionSummary) => {
		setDeletingSessionId(session.id)
		setDeletingSessionName(session.name)
	}

	const handleCancelDelete = () => {
		setDeletingSessionId(null)
		setDeletingSessionName('')
	}

	return (
		<div className="relative w-full h-full overflow-hidden">
			<img
				src={startBackground}
				alt=""
				className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
				onLoad={() => setIsLoaded(true)}
			/>
			<LoadingOverlay isLoading={!isLoaded} />
			<div className="absolute inset-0 flex items-center justify-center">
				<div className="flex flex-col items-center gap-4 px-4">
					<StartButton onClick={onStartNewGame} disabled={!isLoaded}>
						Start New Game
					</StartButton>

					<StartButton
						onClick={() => setIsResumeModalOpen(true)}
						disabled={!isLoaded || sessions.length === 0}
					>
						Resume Saved Game
					</StartButton>
				</div>
			</div>

			<Modal isOpen={isResumeModalOpen} onClose={() => setIsResumeModalOpen(false)} widthVw={40}>
				<div className="h-full p-8 overflow-y-auto">
					<h2 className="text-2xl font-semibold text-slate-900 mb-4">Resume Game</h2>
					<div className="space-y-3">
						{sessions.length === 0 ? (
							<p className="text-slate-700">No saved games available.</p>
						) : (
							sessions.map((session) => {
								const isEditing = editingSessionId === session.id

								return (
									<div
										key={session.id}
										className="rounded-2xl border border-slate-300 bg-white/80 p-4"
									>
										{isEditing ? (
											<div className="space-y-3">
												<input
													type="text"
													value={editingName}
													onChange={(event) => setEditingName(event.target.value)}
													className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
													maxLength={40}
												/>
												<div className="flex gap-3">
													<BackButton onClick={() => handleSaveRename(session.id)}>
														Save
													</BackButton>
													<BackButton variant="gray" onClick={handleCancelRename}>
														Cancel
													</BackButton>
												</div>
											</div>
										) : (
											<div className="flex items-start justify-between gap-4">
												<div>
													<p className="text-lg font-medium text-slate-900">{session.name}</p>
													<p className="text-sm text-slate-700">
														{session.paperCount} papers · Updated {formatDate(session.updatedAt)}
													</p>
												</div>
												<div className="flex gap-3">
													<BackButton variant="gray" onClick={() => handleStartRename(session)}>
														Rename
													</BackButton>
													<BackButton variant="red" onClick={() => handleStartDelete(session)}>
														Delete
													</BackButton>
													<BackButton
														onClick={() => {
															onResumeGame(session.id)
															setIsResumeModalOpen(false)
														}}
													>
														Resume
													</BackButton>
												</div>
											</div>
										)}
									</div>
								)
							})
						)}
					</div>
				</div>
			</Modal>

			<Modal isOpen={!!deletingSessionId} onClose={handleCancelDelete} widthVw={40}>
				<div className="w-full h-full flex flex-col items-center justify-center p-8">
					<h2 className="text-2xl font-semibold text-slate-900 mb-2">Delete Game?</h2>
					<p className="text-lg text-slate-700 mb-8">
						Are you sure you want to delete "{deletingSessionName}"? This cannot be undone.
					</p>
					<div className="flex gap-3">
						<BackButton
							variant="red"
							onClick={() => {
								onDeleteGame(deletingSessionId!)
								handleCancelDelete()
							}}
						>
							Delete
						</BackButton>
						<BackButton variant="gray" onClick={handleCancelDelete}>
							Cancel
						</BackButton>
					</div>
				</div>
			</Modal>
		</div>
	)
}

export default StartScene
