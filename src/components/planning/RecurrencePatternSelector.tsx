import { useState, useEffect } from 'react';
import { RecurrenceType } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { Select, SelectItem, Input, Card, CardBody, Chip } from '@heroui/react';
import { Calendar, Clock, Repeat, RotateCcw, CalendarDays } from 'lucide-react';

interface RecurrencePatternSelectorProps {
  recurrenceType: RecurrenceType;
  recurrenceInterval?: number;
  recurrenceUnit?: 'days' | 'weeks' | 'months';
  startDate?: Date;
  onChange: (
    type: RecurrenceType,
    interval?: number,
    unit?: 'days' | 'weeks' | 'months'
  ) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RecurrencePatternSelector({
  recurrenceType,
  recurrenceInterval = 1,
  recurrenceUnit = 'days',
  startDate,
  onChange,
  size = 'sm',
  className = '',
}: RecurrencePatternSelectorProps) {
  const { t } = useTranslation();
  const [customInterval, setCustomInterval] = useState(recurrenceInterval);
  const [customUnit, setCustomUnit] = useState(recurrenceUnit);

  // Update local state when props change
  useEffect(() => {
    setCustomInterval(recurrenceInterval);
    setCustomUnit(recurrenceUnit);
  }, [recurrenceInterval, recurrenceUnit]);

  const recurrenceOptions = [
    {
      key: RecurrenceType.DAILY,
      label: t('recurrence.daily'),
      description: t('recurrence.daily.description'),
      icon: <Calendar className='w-4 h-4' />,
    },
    {
      key: RecurrenceType.WEEKLY,
      label: t('recurrence.weekly'),
      description: t('recurrence.weekly.description'),
      icon: <CalendarDays className='w-4 h-4' />,
    },
    {
      key: RecurrenceType.BIWEEKLY,
      label: t('recurrence.biweekly'),
      description: t('recurrence.biweekly.description'),
      icon: <RotateCcw className='w-4 h-4' />,
    },
    {
      key: RecurrenceType.EVERY_THREE_WEEKS,
      label: t('recurrence.everyThreeWeeks'),
      description: t('recurrence.everyThreeWeeks.description'),
      icon: <Repeat className='w-4 h-4' />,
    },
    {
      key: RecurrenceType.MONTHLY,
      label: t('recurrence.monthly'),
      description: t('recurrence.monthly.description'),
      icon: <Calendar className='w-4 h-4' />,
    },
    {
      key: RecurrenceType.CUSTOM,
      label: t('recurrence.custom'),
      description: t('recurrence.custom.description'),
      icon: <Clock className='w-4 h-4' />,
    },
  ];

  const unitOptions = [
    {
      key: 'days',
      label: t('recurrence.unit.days'),
      singular: t('recurrence.unit.day'),
    },
    {
      key: 'weeks',
      label: t('recurrence.unit.weeks'),
      singular: t('recurrence.unit.week'),
    },
    {
      key: 'months',
      label: t('recurrence.unit.months'),
      singular: t('recurrence.unit.month'),
    },
  ];

  const selectedRecurrence = recurrenceOptions.find(
    option => option.key === recurrenceType
  );

  const handleRecurrenceTypeChange = (type: RecurrenceType) => {
    if (type === RecurrenceType.CUSTOM) {
      onChange(type, customInterval, customUnit);
    } else {
      onChange(type);
    }
  };

  const handleCustomIntervalChange = (interval: number) => {
    setCustomInterval(interval);
    if (recurrenceType === RecurrenceType.CUSTOM) {
      onChange(RecurrenceType.CUSTOM, interval, customUnit);
    }
  };

  const handleCustomUnitChange = (unit: 'days' | 'weeks' | 'months') => {
    setCustomUnit(unit);
    if (recurrenceType === RecurrenceType.CUSTOM) {
      onChange(RecurrenceType.CUSTOM, customInterval, unit);
    }
  };

  // Calculate next generation dates for preview
  const calculateNextDates = (count: number = 3): Date[] => {
    if (!startDate) {
      return [];
    }

    const dates: Date[] = [];
    let currentDate = new Date(startDate);

    for (let i = 0; i < count; i++) {
      const nextDate = new Date(currentDate);

      switch (recurrenceType) {
        case RecurrenceType.DAILY:
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case RecurrenceType.WEEKLY:
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case RecurrenceType.BIWEEKLY:
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case RecurrenceType.EVERY_THREE_WEEKS:
          nextDate.setDate(nextDate.getDate() + 21);
          break;
        case RecurrenceType.MONTHLY:
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case RecurrenceType.CUSTOM:
          if (customUnit === 'days') {
            nextDate.setDate(nextDate.getDate() + customInterval);
          } else if (customUnit === 'weeks') {
            nextDate.setDate(nextDate.getDate() + customInterval * 7);
          } else if (customUnit === 'months') {
            nextDate.setMonth(nextDate.getMonth() + customInterval);
          }
          break;
      }

      dates.push(new Date(nextDate));
      currentDate = nextDate;
    }

    return dates;
  };

  const nextDates = calculateNextDates();

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getUnitLabel = (interval: number, unit: string): string => {
    const unitOption = unitOptions.find(opt => opt.key === unit);
    if (!unitOption) {
      return unit;
    }

    return interval === 1 ? unitOption.singular : unitOption.label;
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Recurrence Type Selector */}
      <div className='flex flex-col gap-1'>
        <Select
          label={t('recurrence.pattern')}
          placeholder={t('recurrence.selectPattern')}
          selectedKeys={[recurrenceType]}
          onSelectionChange={keys => {
            const type = Array.from(keys)[0] as RecurrenceType;
            handleRecurrenceTypeChange(type);
          }}
          size={size}
          classNames={{
            trigger: 'bg-content2 border-divider data-[hover=true]:bg-content3',
            value: 'text-foreground',
            label: 'text-foreground-600 font-medium',
          }}
          renderValue={() =>
            selectedRecurrence && (
              <div className='flex items-center gap-2'>
                {selectedRecurrence.icon}
                <span>{selectedRecurrence.label}</span>
              </div>
            )
          }
        >
          {recurrenceOptions.map(option => (
            <SelectItem
              key={option.key}
              startContent={option.icon}
              description={option.description}
            >
              {option.label}
            </SelectItem>
          ))}
        </Select>
      </div>

      {/* Custom Interval Configuration */}
      {recurrenceType === RecurrenceType.CUSTOM && (
        <div className='grid grid-cols-2 gap-2'>
          <Input
            type='number'
            label={t('recurrence.interval')}
            placeholder='1'
            value={customInterval.toString()}
            onChange={e => {
              const value = parseInt(e.target.value) || 1;
              handleCustomIntervalChange(Math.max(1, value));
            }}
            min={1}
            max={365}
            size={size}
            classNames={{
              input: 'text-foreground',
              inputWrapper:
                'bg-content2 border-divider data-[hover=true]:bg-content3 group-data-[focus=true]:bg-content2',
              label: 'text-foreground-600 font-medium',
            }}
          />

          <Select
            label={t('recurrence.unit')}
            placeholder={t('recurrence.selectUnit')}
            selectedKeys={[customUnit]}
            onSelectionChange={keys => {
              const unit = Array.from(keys)[0] as 'days' | 'weeks' | 'months';
              handleCustomUnitChange(unit);
            }}
            size={size}
            classNames={{
              trigger:
                'bg-content2 border-divider data-[hover=true]:bg-content3',
              value: 'text-foreground',
              label: 'text-foreground-600 font-medium',
            }}
          >
            {unitOptions.map(unit => (
              <SelectItem key={unit.key}>{unit.label}</SelectItem>
            ))}
          </Select>
        </div>
      )}

      {/* Pattern Summary */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <Repeat className='w-4 h-4 text-foreground-500' />
          <span className='text-sm font-medium text-foreground-600'>
            {t('recurrence.summary')}:
          </span>
          <Chip size='sm' variant='flat' color='primary'>
            {recurrenceType === RecurrenceType.CUSTOM
              ? `${t('recurrence.every')} ${customInterval} ${getUnitLabel(customInterval, customUnit)}`
              : selectedRecurrence?.label}
          </Chip>
        </div>

        {/* Next Generation Dates Preview */}
        {startDate && nextDates.length > 0 && (
          <Card className='bg-content1 border border-divider'>
            <CardBody className='p-3'>
              <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-2'>
                  <Calendar className='w-4 h-4 text-foreground-500' />
                  <span className='text-sm font-medium text-foreground-600'>
                    {t('recurrence.nextDates')}:
                  </span>
                </div>
                <div className='flex flex-wrap gap-1'>
                  {nextDates.map((date, index) => (
                    <Chip
                      key={index}
                      size='sm'
                      variant='flat'
                      color='secondary'
                      className='text-xs'
                    >
                      {formatDate(date)}
                    </Chip>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
