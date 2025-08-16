// Modal component for viewing task time history
import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Coffee, Play, Pause } from 'lucide-react';
import { Task, TimerSession } from '../../types';
import { TimeTrackingRepository } from '../../services/database/repositories/TimeTrackingRepository';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Card,
  CardBody,
  Chip,
  Divider,
} from "@heroui/react";

interface TimeHistoryModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export function TimeHistoryModal({ task, isOpen, onClose }: TimeHistoryModalProps) {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      loadTimeSessions();
    }
  }, [isOpen, task]);

  const loadTimeSessions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const timeTrackingRepo = new TimeTrackingRepository();
      const taskSessions = await timeTrackingRepo.getByTask(task.id);
      setSessions(taskSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (milliseconds: number): string => {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getSessionDuration = (session: TimerSession): number => {
    if (!session.endTime) return 0;
    const startTime = typeof session.startTime === 'string' ? new Date(session.startTime) : session.startTime;
    const endTime = typeof session.endTime === 'string' ? new Date(session.endTime) : session.endTime;
    return endTime.getTime() - startTime.getTime() - session.pausedTime;
  };

  const completedSessions = sessions.filter(s => s.endTime);
  const totalWorkTime = completedSessions.reduce((total, session) => total + getSessionDuration(session), 0);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader className="pb-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-semibold">Time History</span>
            </div>
            <span className="text-sm text-default-500 font-normal">{task.title}</span>
          </div>
        </ModalHeader>
        
        <ModalBody className="gap-4 py-0 pb-6">
          {/* Compact Stats */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{completedSessions.length}</div>
                <div className="text-xs text-default-400">Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-success">{formatDuration(totalWorkTime)}</div>
                <div className="text-xs text-default-400">Total Time</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-warning">{task.actualTime}min</div>
                <div className="text-xs text-default-400">Recorded</div>
              </div>
            </div>
          </div>

          <Divider />

          {/* Sessions List */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto"></div>
              <p className="text-default-400 mt-2 text-sm">Loading...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-danger text-sm">{error}</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-default-300 mx-auto mb-2" />
              <p className="text-default-400 text-sm">No sessions yet</p>
              <p className="text-xs text-default-300 mt-1">Start a timer to track work on this task</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session, index) => {
                const startTime = typeof session.startTime === 'string' ? new Date(session.startTime) : session.startTime;
                const endTime = session.endTime ? (typeof session.endTime === 'string' ? new Date(session.endTime) : session.endTime) : null;
                
                return (
                  <div key={session.id} className="group p-3 rounded-lg hover:bg-default-50 border border-transparent hover:border-default-200 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-default-400">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(startTime)}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-default-500">
                          <span>{formatTime(startTime)}</span>
                          {endTime && (
                            <>
                              <span>→</span>
                              <span>{formatTime(endTime)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {session.breaks.length > 0 && (
                          <Chip size="sm" variant="flat" startContent={<Coffee className="w-3 h-3" />} className="text-xs">
                            {session.breaks.length}
                          </Chip>
                        )}
                        
                        {endTime ? (
                          <Chip size="sm" color="success" variant="flat" className="font-medium">
                            {formatDuration(getSessionDuration(session))}
                          </Chip>
                        ) : (
                          <Chip size="sm" color="warning" variant="flat" startContent={<Play className="w-3 h-3" />}>
                            Active
                          </Chip>
                        )}
                      </div>
                    </div>
                    
                    {session.notes && (
                      <div className="mt-2 text-xs text-default-600 pl-5">
                        {session.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}