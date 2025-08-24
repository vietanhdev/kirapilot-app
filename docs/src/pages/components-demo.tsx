import React from 'react';
import Layout from '@theme/Layout';
import { FeatureCard, CodeExample, ScreenshotGallery } from '../components';
import type { ScreenshotItem } from '../components';

const sampleScreenshots: ScreenshotItem[] = [
  {
    src: '/img/kirapilot-screenshot.png',
    alt: 'KiraPilot main interface',
    title: 'Main Interface',
    caption:
      'The main KiraPilot interface showing task management and timer features.',
  },
  {
    src: '/img/kirapilot-logo.png',
    alt: 'KiraPilot logo',
    title: 'KiraPilot Logo',
    caption: 'The official KiraPilot logo and branding.',
  },
];

const sampleCode = `import { useState } from 'react';
import { Task, TaskStatus } from '../types';

function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const createTask = (title: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      status: TaskStatus.TODO,
      createdAt: new Date(),
    };
    
    setTasks(prev => [...prev, newTask]);
  };
  
  return (
    <div className="task-manager">
      <h2>My Tasks</h2>
      {tasks.map(task => (
        <div key={task.id} className="task-item">
          {task.title}
        </div>
      ))}
    </div>
  );
}`;

export default function ComponentsDemo(): React.JSX.Element {
  return (
    <Layout
      title='Components Demo'
      description='Demonstration of custom KiraPilot documentation components'
    >
      <div className='container margin-vert--lg'>
        <div className='row'>
          <div className='col'>
            <h1>Components Demo</h1>
            <p>
              This page demonstrates the custom components created for the
              KiraPilot documentation.
            </p>

            <h2>FeatureCard Component</h2>
            <div className='row margin-vert--lg'>
              <div className='col col--4'>
                <FeatureCard
                  title='Task Management'
                  description='Organize your work with rich text descriptions, priority levels, and intelligent scheduling.'
                  icon='✅'
                  link='/docs/user-guide/task-management'
                  category='user'
                />
              </div>
              <div className='col col--4'>
                <FeatureCard
                  title='Developer API'
                  description='Comprehensive API documentation for extending and integrating with KiraPilot.'
                  icon='🔧'
                  link='/docs/api/database-schema'
                  category='developer'
                />
              </div>
              <div className='col col--4'>
                <FeatureCard
                  title='AI Assistant'
                  description='Natural language interface with access to all app features and intelligent suggestions.'
                  icon='🤖'
                  link='/docs/user-guide/ai-assistant'
                  category='user'
                />
              </div>
            </div>

            <h2>CodeExample Component</h2>
            <CodeExample
              language='typescript'
              code={sampleCode}
              title='Task Manager Example'
              showLineNumbers={true}
              highlightLines={[8, 9, 10, 11, 12, 13, 14]}
            />

            <h2>ScreenshotGallery Component - Grid Layout</h2>
            <ScreenshotGallery images={sampleScreenshots} layout='grid' />

            <h2>ScreenshotGallery Component - Carousel Layout</h2>
            <ScreenshotGallery images={sampleScreenshots} layout='carousel' />
          </div>
        </div>
      </div>
    </Layout>
  );
}
