import { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Progress,
  Spinner,
  Accordion,
  AccordionItem,
} from '@heroui/react';
import {
  TrendingUp,
  Clock,
  Target,
  Lightbulb,
  BarChart3,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Zap,
  Calendar,
} from 'lucide-react';
import { useProductivityInsights, useWorkingStyleInsights } from '../../hooks';
import { PersonalizedRecommendation } from '../../services/ai/ProductivityInsightsService';

interface ProductivityInsightsPanelProps {
  userId?: string;
  className?: string;
}

export function ProductivityInsightsPanel({
  userId = 'current-user',
  className = '',
}: ProductivityInsightsPanelProps) {
  const [selectedTab, setSelectedTab] = useState<
    'overview' | 'recommendations' | 'patterns'
  >('overview');

  const {
    patternAnalysis,
    personalizedTips,
    isAnalyzing,
    isGeneratingTips,
    analysisError,
    tipsError,
    analyzePatterns,
    generateTips,
    clearErrors,
  } = useProductivityInsights(userId);

  const {
    workingStyle,
    isLoading: isLoadingWorkingStyle,
    getBestWorkingHours,
    getEnergyRecommendation,
  } = useWorkingStyleInsights();

  const handleRefresh = async () => {
    clearErrors();
    await analyzePatterns();
    await generateTips();
  };

  const currentHour = new Date().getHours();
  const energyRecommendation = getEnergyRecommendation(currentHour);
  const bestWorkingHours = getBestWorkingHours();

  if (analysisError || tipsError) {
    return (
      <Card className={className}>
        <CardBody className='text-center py-8'>
          <AlertCircle className='w-12 h-12 text-danger mx-auto mb-4' />
          <h3 className='text-lg font-semibold mb-2'>
            Unable to Load Insights
          </h3>
          <p className='text-default-500 mb-4'>{analysisError || tipsError}</p>
          <Button
            color='primary'
            variant='flat'
            onPress={handleRefresh}
            startContent={<RefreshCw className='w-4 h-4' />}
          >
            Try Again
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className='flex justify-between items-center'>
          <div className='flex items-center gap-2'>
            <BarChart3 className='w-5 h-5 text-primary' />
            <h2 className='text-xl font-semibold'>Productivity Insights</h2>
          </div>
          <Button
            size='sm'
            variant='flat'
            onPress={handleRefresh}
            isLoading={isAnalyzing || isGeneratingTips}
            startContent={
              !isAnalyzing &&
              !isGeneratingTips && <RefreshCw className='w-4 h-4' />
            }
          >
            Refresh
          </Button>
        </CardHeader>
      </Card>

      {/* Tab Navigation */}
      <div className='flex gap-2'>
        <Button
          variant={selectedTab === 'overview' ? 'solid' : 'flat'}
          color={selectedTab === 'overview' ? 'primary' : 'default'}
          onPress={() => setSelectedTab('overview')}
          size='sm'
        >
          Overview
        </Button>
        <Button
          variant={selectedTab === 'recommendations' ? 'solid' : 'flat'}
          color={selectedTab === 'recommendations' ? 'primary' : 'default'}
          onPress={() => setSelectedTab('recommendations')}
          size='sm'
        >
          Recommendations
        </Button>
        <Button
          variant={selectedTab === 'patterns' ? 'solid' : 'flat'}
          color={selectedTab === 'patterns' ? 'primary' : 'default'}
          onPress={() => setSelectedTab('patterns')}
          size='sm'
        >
          Patterns
        </Button>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className='space-y-4'>
          {/* Current Energy Status */}
          {energyRecommendation && (
            <Card>
              <CardBody>
                <div className='flex items-center gap-3'>
                  <Zap
                    className={`w-6 h-6 ${
                      energyRecommendation.type === 'high-energy'
                        ? 'text-success'
                        : energyRecommendation.type === 'low-energy'
                          ? 'text-warning'
                          : 'text-primary'
                    }`}
                  />
                  <div className='flex-1'>
                    <h3 className='font-semibold'>Current Energy Level</h3>
                    <p className='text-sm text-default-500'>
                      {energyRecommendation.message}
                    </p>
                  </div>
                  <div className='text-right'>
                    <div className='text-2xl font-bold'>
                      {Math.round(energyRecommendation.energy)}%
                    </div>
                    <div className='text-xs text-default-500'>Energy</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Key Metrics */}
          {patternAnalysis && (
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <Card>
                <CardBody className='text-center'>
                  <Target className='w-8 h-8 text-success mx-auto mb-2' />
                  <div className='text-2xl font-bold text-success'>
                    {patternAnalysis.insights.completionRate.toFixed(1)}%
                  </div>
                  <div className='text-sm text-default-500'>
                    Completion Rate
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className='text-center'>
                  <Clock className='w-8 h-8 text-primary mx-auto mb-2' />
                  <div className='text-2xl font-bold text-primary'>
                    {Math.round(patternAnalysis.insights.averageTaskDuration)}m
                  </div>
                  <div className='text-sm text-default-500'>
                    Avg Task Duration
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className='text-center'>
                  <TrendingUp className='w-8 h-8 text-warning mx-auto mb-2' />
                  <div className='text-2xl font-bold text-warning'>
                    {patternAnalysis.insights.focusEfficiency.toFixed(1)}%
                  </div>
                  <div className='text-sm text-default-500'>
                    Focus Efficiency
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Best Working Hours */}
          {bestWorkingHours && bestWorkingHours.length > 0 && (
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Calendar className='w-5 h-5 text-primary' />
                  <h3 className='font-semibold'>Your Best Working Hours</h3>
                </div>
              </CardHeader>
              <CardBody>
                <div className='flex flex-wrap gap-2'>
                  {bestWorkingHours.map((timeSlot, index) => (
                    <Chip key={index} color='primary' variant='flat' size='sm'>
                      {timeSlot.start} - {timeSlot.end}
                    </Chip>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Recommendations Tab */}
      {selectedTab === 'recommendations' && (
        <div className='space-y-4'>
          {isGeneratingTips ? (
            <Card>
              <CardBody className='text-center py-8'>
                <Spinner size='lg' />
                <p className='mt-4 text-default-500'>
                  Generating personalized recommendations...
                </p>
              </CardBody>
            </Card>
          ) : personalizedTips.length > 0 ? (
            <div className='space-y-3'>
              {personalizedTips.map(tip => (
                <RecommendationCard key={tip.id} recommendation={tip} />
              ))}
            </div>
          ) : (
            <Card>
              <CardBody className='text-center py-8'>
                <Lightbulb className='w-12 h-12 text-default-300 mx-auto mb-4' />
                <h3 className='text-lg font-semibold mb-2'>
                  No Recommendations Yet
                </h3>
                <p className='text-default-500 mb-4'>
                  We need more data to generate personalized recommendations.
                </p>
                <Button
                  color='primary'
                  variant='flat'
                  onPress={() => generateTips()}
                >
                  Generate Recommendations
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Patterns Tab */}
      {selectedTab === 'patterns' && (
        <div className='space-y-4'>
          {isAnalyzing || isLoadingWorkingStyle ? (
            <Card>
              <CardBody className='text-center py-8'>
                <Spinner size='lg' />
                <p className='mt-4 text-default-500'>
                  Analyzing your productivity patterns...
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className='space-y-4'>
              {/* Working Style Summary */}
              {workingStyle && (
                <Card>
                  <CardHeader>
                    <h3 className='font-semibold'>Your Working Style</h3>
                  </CardHeader>
                  <CardBody className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <div className='text-sm text-default-500'>
                          Focus Pattern
                        </div>
                        <div className='font-semibold capitalize'>
                          {workingStyle.focusPatterns}
                        </div>
                      </div>
                      <div>
                        <div className='text-sm text-default-500'>
                          Task Completion Style
                        </div>
                        <div className='font-semibold capitalize'>
                          {workingStyle.taskCompletionStyle.replace('_', ' ')}
                        </div>
                      </div>
                      <div>
                        <div className='text-sm text-default-500'>
                          Average Task Duration
                        </div>
                        <div className='font-semibold'>
                          {Math.round(workingStyle.averageTaskDuration)} minutes
                        </div>
                      </div>
                      <div>
                        <div className='text-sm text-default-500'>
                          Break Frequency
                        </div>
                        <div className='font-semibold'>
                          Every {Math.round(workingStyle.breakFrequency)}{' '}
                          minutes
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Pattern Analysis */}
              {patternAnalysis && (
                <Card>
                  <CardHeader>
                    <h3 className='font-semibold'>Productivity Patterns</h3>
                  </CardHeader>
                  <CardBody>
                    <Accordion>
                      <AccordionItem
                        key='productivity'
                        title={`${patternAnalysis.productivityPatterns.length} Productivity Patterns Found`}
                      >
                        <div className='space-y-2'>
                          {patternAnalysis.productivityPatterns.map(pattern => (
                            <div
                              key={pattern.id}
                              className='p-3 bg-default-50 rounded-lg'
                            >
                              <div className='flex justify-between items-start'>
                                <div>
                                  <div className='font-medium capitalize'>
                                    {pattern.patternType.replace('_', ' ')}{' '}
                                    Pattern
                                  </div>
                                  <div className='text-sm text-default-500'>
                                    {pattern.productivity.toFixed(1)}%
                                    productivity
                                  </div>
                                </div>
                                <Chip size='sm' color='primary' variant='flat'>
                                  {pattern.confidence}% confidence
                                </Chip>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionItem>

                      <AccordionItem
                        key='energy'
                        title={`${patternAnalysis.energyPatterns.length} Energy Patterns Found`}
                      >
                        <div className='space-y-2'>
                          {patternAnalysis.energyPatterns.map(
                            (pattern, index) => (
                              <div
                                key={index}
                                className='p-3 bg-default-50 rounded-lg'
                              >
                                <div className='flex justify-between items-center'>
                                  <div>
                                    <div className='font-medium'>
                                      {pattern.timeSlot.start} -{' '}
                                      {pattern.timeSlot.end}
                                    </div>
                                    <div className='text-sm text-default-500'>
                                      {pattern.averageEnergy.toFixed(1)}% energy
                                      level
                                    </div>
                                  </div>
                                  <Progress
                                    value={pattern.averageEnergy}
                                    className='w-20'
                                    color={
                                      pattern.averageEnergy > 70
                                        ? 'success'
                                        : pattern.averageEnergy > 40
                                          ? 'warning'
                                          : 'danger'
                                    }
                                    size='sm'
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </AccordionItem>
                    </Accordion>
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Recommendation Card Component
function RecommendationCard({
  recommendation,
}: {
  recommendation: PersonalizedRecommendation;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardBody>
        <div className='space-y-3'>
          {/* Header */}
          <div className='flex justify-between items-start'>
            <div className='flex-1'>
              <h4 className='font-semibold text-lg'>{recommendation.title}</h4>
              <p className='text-default-600 mt-1'>
                {recommendation.description}
              </p>
            </div>
            <div className='flex flex-col items-end gap-2 ml-4'>
              <Chip
                size='sm'
                color={getRecommendationDifficultyColor(
                  recommendation.difficulty
                )}
                variant='flat'
              >
                {recommendation.difficulty}
              </Chip>
              <div className='text-xs text-default-500'>
                {recommendation.timeToImplement}min to implement
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className='flex gap-4 text-sm'>
            <div className='flex items-center gap-1'>
              <div className='w-2 h-2 bg-success rounded-full'></div>
              <span>Confidence: {recommendation.confidence}%</span>
            </div>
            <div className='flex items-center gap-1'>
              <div className='w-2 h-2 bg-primary rounded-full'></div>
              <span>Impact: {recommendation.estimatedImpact}%</span>
            </div>
          </div>

          {/* Primary Action */}
          <div className='bg-primary-50 p-3 rounded-lg'>
            <div className='font-medium text-primary-700 mb-1'>
              Recommended Action:
            </div>
            <div className='text-primary-600'>
              {recommendation.actions.primary}
            </div>
          </div>

          {/* Expandable Details */}
          {(recommendation.reasoning || recommendation.actions.secondary) && (
            <>
              <Button
                variant='light'
                size='sm'
                onPress={() => setIsExpanded(!isExpanded)}
                className='w-full'
              >
                {isExpanded ? 'Show Less' : 'Show More Details'}
              </Button>

              {isExpanded && (
                <div className='space-y-3 pt-2 border-t border-default-200'>
                  {recommendation.reasoning && (
                    <div>
                      <div className='font-medium text-sm mb-1'>
                        Why this helps:
                      </div>
                      <div className='text-sm text-default-600'>
                        {recommendation.reasoning}
                      </div>
                    </div>
                  )}

                  {recommendation.actions.secondary &&
                    recommendation.actions.secondary.length > 0 && (
                      <div>
                        <div className='font-medium text-sm mb-2'>
                          Additional actions:
                        </div>
                        <ul className='space-y-1'>
                          {recommendation.actions.secondary.map(
                            (action, index) => (
                              <li
                                key={index}
                                className='text-sm text-default-600 flex items-start gap-2'
                              >
                                <CheckCircle className='w-3 h-3 text-success mt-0.5 flex-shrink-0' />
                                {action}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function getRecommendationDifficultyColor(
  difficulty: 'easy' | 'medium' | 'hard'
) {
  switch (difficulty) {
    case 'easy':
      return 'success' as const;
    case 'medium':
      return 'warning' as const;
    case 'hard':
      return 'danger' as const;
    default:
      return 'default' as const;
  }
}
