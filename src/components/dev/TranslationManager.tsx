import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Progress,
  Chip,
  Divider,
  Accordion,
  AccordionItem,
  Code,
  Snippet,
} from '@heroui/react';
import {
  Languages,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  FileText,
  Globe,
} from 'lucide-react';

import { translations, languages, type Language } from '../../i18n';
import {
  validateTranslationCoverage,
  findInconsistentTranslationKeys,
} from '../../utils/translationValidation';
import { validateTranslationConsistency } from '../../utils/translationConsistency';

interface TranslationManagerProps {
  className?: string;
}

interface LanguageStats {
  language: Language;
  name: string;
  totalKeys: number;
  missingKeys: string[];
  extraKeys: string[];
  coverage: number;
  health: 'excellent' | 'good' | 'needs-improvement' | 'critical';
}

export const TranslationManager: React.FC<TranslationManagerProps> = ({
  className = '',
}) => {
  const [languageStats, setLanguageStats] = useState<LanguageStats[]>([]);
  const [inconsistentKeys, setInconsistentKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    analyzeTranslations();
  }, []);

  const analyzeTranslations = async () => {
    setIsLoading(true);

    try {
      // Get coverage reports
      const coverageReports = validateTranslationCoverage();

      // Get inconsistent keys
      const inconsistent = findInconsistentTranslationKeys();
      setInconsistentKeys(inconsistent);

      // Get consistency validation
      const consistencyResult = validateTranslationConsistency();

      // Build language stats
      const stats: LanguageStats[] = [];

      // Add English as reference
      const englishKeys = Object.keys(translations.en);
      stats.push({
        language: 'en',
        name: languages.en,
        totalKeys: englishKeys.length,
        missingKeys: [],
        extraKeys: [],
        coverage: 100,
        health: 'excellent',
      });

      // Add other languages
      for (const report of coverageReports) {
        const healthScore =
          consistencyResult.summary.languageHealth[report.language];
        let health: LanguageStats['health'];

        if (healthScore >= 95) {
          health = 'excellent';
        } else if (healthScore >= 85) {
          health = 'good';
        } else if (healthScore >= 70) {
          health = 'needs-improvement';
        } else {
          health = 'critical';
        }

        stats.push({
          language: report.language,
          name: languages[report.language],
          totalKeys: report.totalKeys,
          missingKeys: report.missingKeys,
          extraKeys: report.extraKeys,
          coverage: report.coveragePercentage,
          health,
        });
      }

      setLanguageStats(stats);
    } catch (error) {
      console.error('Error analyzing translations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthColor = (health: LanguageStats['health']) => {
    switch (health) {
      case 'excellent': {
        return 'success';
      }
      case 'good': {
        return 'primary';
      }
      case 'needs-improvement': {
        return 'warning';
      }
      case 'critical': {
        return 'danger';
      }
      default: {
        return 'default';
      }
    }
  };

  const getHealthIcon = (health: LanguageStats['health']) => {
    switch (health) {
      case 'excellent': {
        return <CheckCircle className='w-4 h-4' />;
      }
      case 'good': {
        return <CheckCircle className='w-4 h-4' />;
      }
      case 'needs-improvement': {
        return <AlertTriangle className='w-4 h-4' />;
      }
      case 'critical': {
        return <XCircle className='w-4 h-4' />;
      }
      default: {
        return null;
      }
    }
  };

  const exportTranslations = () => {
    const csvContent = generateCSVExport();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kirapilot-translations.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateCSVExport = (): string => {
    const englishKeys = Object.keys(translations.en);
    const headers = ['Key', ...Object.keys(languages)];
    const rows = [headers.join(',')];

    for (const key of englishKeys) {
      const row = [key];

      for (const lang of Object.keys(languages) as Language[]) {
        const translation =
          (translations[lang] as Record<string, string>)[key] || '';
        // Escape quotes and wrap in quotes for CSV
        const escapedTranslation = `"${translation.replace(/"/g, '""')}"`;
        row.push(escapedTranslation);
      }

      rows.push(row.join(','));
    }

    return rows.join('\n');
  };

  const generateTranslationStubs = (language: Language) => {
    const stats = languageStats.find(s => s.language === language);
    if (!stats || stats.missingKeys.length === 0) {
      return;
    }

    const englishTranslations = translations.en as Record<string, string>;
    const stubs = stats.missingKeys
      .map(key => {
        const englishValue = englishTranslations[key];
        return `  '${key}': '${englishValue}', // TODO: Translate to ${languages[language]}`;
      })
      .join('\n');

    const blob = new Blob([stubs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-stubs-${language}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className='text-center'>
          <RefreshCw className='w-8 h-8 animate-spin text-primary mx-auto mb-2' />
          <p className='text-foreground-600'>Analyzing translations...</p>
        </div>
      </div>
    );
  }

  const overallStats = {
    totalLanguages: languageStats.length,
    excellentLanguages: languageStats.filter(s => s.health === 'excellent')
      .length,
    criticalLanguages: languageStats.filter(s => s.health === 'critical')
      .length,
    averageCoverage: Math.round(
      languageStats.reduce((sum, s) => sum + s.coverage, 0) /
        languageStats.length
    ),
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Languages className='w-6 h-6 text-primary' />
          <div>
            <h2 className='text-xl font-semibold text-foreground'>
              Translation Manager
            </h2>
            <p className='text-sm text-foreground-600'>
              Manage and monitor translation coverage across all supported
              languages
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            variant='bordered'
            size='sm'
            startContent={<RefreshCw className='w-4 h-4' />}
            onPress={analyzeTranslations}
          >
            Refresh
          </Button>
          <Button
            variant='bordered'
            size='sm'
            startContent={<Download className='w-4 h-4' />}
            onPress={exportTranslations}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card>
          <CardBody className='text-center'>
            <Globe className='w-8 h-8 text-primary mx-auto mb-2' />
            <p className='text-2xl font-bold text-foreground'>
              {overallStats.totalLanguages}
            </p>
            <p className='text-sm text-foreground-600'>Languages</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className='text-center'>
            <CheckCircle className='w-8 h-8 text-success mx-auto mb-2' />
            <p className='text-2xl font-bold text-foreground'>
              {overallStats.excellentLanguages}
            </p>
            <p className='text-sm text-foreground-600'>Excellent</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className='text-center'>
            <XCircle className='w-8 h-8 text-danger mx-auto mb-2' />
            <p className='text-2xl font-bold text-foreground'>
              {overallStats.criticalLanguages}
            </p>
            <p className='text-sm text-foreground-600'>Critical</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className='text-center'>
            <div className='w-8 h-8 mx-auto mb-2 flex items-center justify-center'>
              <Progress
                value={overallStats.averageCoverage}
                className='w-8'
                size='sm'
                color='primary'
              />
            </div>
            <p className='text-2xl font-bold text-foreground'>
              {overallStats.averageCoverage}%
            </p>
            <p className='text-sm text-foreground-600'>Avg Coverage</p>
          </CardBody>
        </Card>
      </div>

      {/* Language Details */}
      <Card>
        <CardHeader>
          <h3 className='text-lg font-semibold text-foreground'>
            Language Coverage Details
          </h3>
        </CardHeader>
        <CardBody>
          <div className='space-y-4'>
            {languageStats.map(stats => (
              <div key={stats.language} className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <Chip
                      color={getHealthColor(stats.health)}
                      variant='flat'
                      startContent={getHealthIcon(stats.health)}
                      size='sm'
                    >
                      {stats.language.toUpperCase()}
                    </Chip>
                    <span className='font-medium text-foreground'>
                      {stats.name}
                    </span>
                    <span className='text-sm text-foreground-600'>
                      ({stats.totalKeys} keys)
                    </span>
                  </div>

                  <div className='flex items-center gap-3'>
                    <Progress
                      value={stats.coverage}
                      className='w-32'
                      color={getHealthColor(stats.health)}
                      size='sm'
                    />
                    <span className='text-sm font-medium text-foreground min-w-[3rem]'>
                      {stats.coverage}%
                    </span>

                    {stats.missingKeys.length > 0 && (
                      <Button
                        size='sm'
                        variant='bordered'
                        startContent={<FileText className='w-3 h-3' />}
                        onPress={() => generateTranslationStubs(stats.language)}
                      >
                        Stubs
                      </Button>
                    )}
                  </div>
                </div>

                {(stats.missingKeys.length > 0 ||
                  stats.extraKeys.length > 0) && (
                  <Accordion variant='bordered' className='px-0'>
                    <AccordionItem
                      key={`${stats.language}-details`}
                      title={
                        <div className='flex items-center gap-2'>
                          <span className='text-sm'>Issues</span>
                          {stats.missingKeys.length > 0 && (
                            <Chip size='sm' color='danger' variant='flat'>
                              {stats.missingKeys.length} missing
                            </Chip>
                          )}
                          {stats.extraKeys.length > 0 && (
                            <Chip size='sm' color='warning' variant='flat'>
                              {stats.extraKeys.length} extra
                            </Chip>
                          )}
                        </div>
                      }
                    >
                      <div className='space-y-4'>
                        {stats.missingKeys.length > 0 && (
                          <div>
                            <h4 className='text-sm font-medium text-danger mb-2'>
                              Missing Keys ({stats.missingKeys.length})
                            </h4>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                              {stats.missingKeys.slice(0, 20).map(key => (
                                <Code key={key} size='sm' color='danger'>
                                  {key}
                                </Code>
                              ))}
                            </div>
                            {stats.missingKeys.length > 20 && (
                              <p className='text-xs text-foreground-600 mt-2'>
                                ... and {stats.missingKeys.length - 20} more
                              </p>
                            )}
                          </div>
                        )}

                        {stats.extraKeys.length > 0 && (
                          <div>
                            <h4 className='text-sm font-medium text-warning mb-2'>
                              Extra Keys ({stats.extraKeys.length})
                            </h4>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                              {stats.extraKeys.slice(0, 10).map(key => (
                                <Code key={key} size='sm' color='warning'>
                                  {key}
                                </Code>
                              ))}
                            </div>
                            {stats.extraKeys.length > 10 && (
                              <p className='text-xs text-foreground-600 mt-2'>
                                ... and {stats.extraKeys.length - 10} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Inconsistent Keys */}
      {inconsistentKeys.length > 0 && (
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='w-5 h-5 text-warning' />
              <h3 className='text-lg font-semibold text-foreground'>
                Inconsistent Keys ({inconsistentKeys.length})
              </h3>
            </div>
          </CardHeader>
          <CardBody>
            <p className='text-sm text-foreground-600 mb-4'>
              These keys exist in some languages but not others. Consider
              removing unused keys or adding missing translations.
            </p>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
              {inconsistentKeys.slice(0, 30).map(key => (
                <Code key={key} size='sm' color='warning'>
                  {key}
                </Code>
              ))}
            </div>
            {inconsistentKeys.length > 30 && (
              <p className='text-xs text-foreground-600 mt-4'>
                ... and {inconsistentKeys.length - 30} more inconsistent keys
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <h3 className='text-lg font-semibold text-foreground'>
            How to Use Translation Manager
          </h3>
        </CardHeader>
        <CardBody className='space-y-4'>
          <div>
            <h4 className='font-medium text-foreground mb-2'>
              🔍 Coverage Analysis
            </h4>
            <p className='text-sm text-foreground-600'>
              Monitor translation coverage across all supported languages.
              Languages with less than 85% coverage need attention.
            </p>
          </div>

          <Divider />

          <div>
            <h4 className='font-medium text-foreground mb-2'>
              📝 Translation Stubs
            </h4>
            <p className='text-sm text-foreground-600'>
              Click "Stubs" next to any language to download a file with missing
              translation keys. Copy these to your locale file and translate
              them.
            </p>
          </div>

          <Divider />

          <div>
            <h4 className='font-medium text-foreground mb-2'>📊 CSV Export</h4>
            <p className='text-sm text-foreground-600'>
              Export all translations to CSV for external translation tools or
              collaboration with translators.
            </p>
          </div>

          <Divider />

          <div>
            <h4 className='font-medium text-foreground mb-2'>
              🔧 Command Line Tools
            </h4>
            <p className='text-sm text-foreground-600 mb-2'>
              Use the command line script for automated translation management:
            </p>
            <Snippet size='sm' className='w-full'>
              node scripts/i18n-manager.js check
            </Snippet>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
