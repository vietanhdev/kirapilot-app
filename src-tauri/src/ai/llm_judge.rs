use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::ai::{AIResult, AIServiceError, GenerationOptions, LLMProvider};
use crate::ai::react_engine::ReActChain;

/// Evaluation criteria for LLM as Judge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationCriteria {
    /// Weight for reasoning quality (0.0 to 1.0)
    pub reasoning_weight: f64,
    
    /// Weight for tool usage appropriateness (0.0 to 1.0)
    pub tool_usage_weight: f64,
    
    /// Weight for response relevance (0.0 to 1.0)
    pub relevance_weight: f64,
    
    /// Weight for response completeness (0.0 to 1.0)
    pub completeness_weight: f64,
    
    /// Weight for efficiency (0.0 to 1.0)
    pub efficiency_weight: f64,
}

impl Default for EvaluationCriteria {
    fn default() -> Self {
        Self {
            reasoning_weight: 0.25,
            tool_usage_weight: 0.20,
            relevance_weight: 0.25,
            completeness_weight: 0.20,
            efficiency_weight: 0.10,
        }
    }
}

/// Individual score for a specific evaluation aspect
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AspectScore {
    /// Score from 0.0 to 10.0
    pub score: f64,
    
    /// Explanation for the score
    pub explanation: String,
    
    /// Specific feedback for improvement
    pub feedback: Option<String>,
}

/// Complete evaluation result from LLM as Judge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JudgeEvaluation {
    /// Unique identifier for this evaluation
    pub id: String,
    
    /// ID of the ReAct chain being evaluated
    pub chain_id: String,
    
    /// Overall quality score (0.0 to 10.0)
    pub overall_score: f64,
    
    /// Individual aspect scores
    pub reasoning_quality: AspectScore,
    pub tool_usage: AspectScore,
    pub relevance: AspectScore,
    pub completeness: AspectScore,
    pub efficiency: AspectScore,
    
    /// General feedback and suggestions
    pub general_feedback: String,
    
    /// Specific improvement recommendations
    pub recommendations: Vec<String>,
    
    /// Timestamp when evaluation was performed
    pub evaluated_at: DateTime<Utc>,
    
    /// Model used for evaluation
    pub judge_model: String,
    
    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Configuration for LLM Judge evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JudgeConfig {
    /// Evaluation criteria and weights
    pub criteria: EvaluationCriteria,
    
    /// Whether to include detailed step-by-step analysis
    pub detailed_analysis: bool,
    
    /// Whether to provide improvement suggestions
    pub provide_suggestions: bool,
    
    /// Custom evaluation prompt template
    pub custom_prompt: Option<String>,
    
    /// Maximum tokens for judge response
    pub max_tokens: Option<u32>,
    
    /// Temperature for judge LLM (lower = more consistent)
    pub temperature: Option<f32>,
}

impl Default for JudgeConfig {
    fn default() -> Self {
        Self {
            criteria: EvaluationCriteria::default(),
            detailed_analysis: true,
            provide_suggestions: true,
            custom_prompt: None,
            max_tokens: Some(2048),
            temperature: Some(0.3), // Lower temperature for more consistent evaluation
        }
    }
}

/// LLM as Judge evaluator for ReAct reasoning chains
pub struct LLMJudge {
    config: JudgeConfig,
}

impl LLMJudge {
    /// Create a new LLM Judge with default configuration
    pub fn new() -> Self {
        Self {
            config: JudgeConfig::default(),
        }
    }
    
    /// Create a new LLM Judge with custom configuration
    pub fn with_config(config: JudgeConfig) -> Self {
        Self { config }
    }
    
    /// Evaluate a ReAct reasoning chain
    pub async fn evaluate_chain(
        &self,
        chain: &ReActChain,
        judge_provider: &dyn LLMProvider,
    ) -> AIResult<JudgeEvaluation> {
        let evaluation_prompt = self.build_evaluation_prompt(chain);
        
        let options = GenerationOptions {
            max_tokens: self.config.max_tokens,
            temperature: self.config.temperature,
            top_p: Some(0.9),
            stop_sequences: None,
            stream: false,
        };
        
        let judge_response = judge_provider
            .generate(&evaluation_prompt, &options)
            .await
            .map_err(|e| AIServiceError::llm_error(format!("Judge evaluation failed: {}", e)))?;
        
        self.parse_judge_response(chain, &judge_response, judge_provider)
    }
    
    /// Build the evaluation prompt for the judge
    fn build_evaluation_prompt(&self, chain: &ReActChain) -> String {
        if let Some(custom_prompt) = &self.config.custom_prompt {
            return self.substitute_prompt_variables(custom_prompt, chain);
        }
        
        let default_prompt = self.build_default_evaluation_prompt(chain);
        default_prompt
    }
    
    /// Build the default evaluation prompt
    fn build_default_evaluation_prompt(&self, chain: &ReActChain) -> String {
        let chain_summary = self.summarize_chain(chain);
        let criteria_description = self.describe_criteria();
        
        format!(
            r#"You are an expert AI evaluator tasked with assessing the quality of a ReAct (Reasoning and Acting) reasoning chain. 

Please evaluate the following ReAct reasoning chain based on these criteria:

{criteria_description}

## User Request
{user_request}

## ReAct Reasoning Chain
{chain_summary}

## Final Response
{final_response}

## Evaluation Instructions
Please provide a detailed evaluation in the following JSON format:

```json
{{
    "reasoning_quality": {{
        "score": <0.0-10.0>,
        "explanation": "<detailed explanation>",
        "feedback": "<specific improvement suggestions>"
    }},
    "tool_usage": {{
        "score": <0.0-10.0>,
        "explanation": "<detailed explanation>",
        "feedback": "<specific improvement suggestions>"
    }},
    "relevance": {{
        "score": <0.0-10.0>,
        "explanation": "<detailed explanation>",
        "feedback": "<specific improvement suggestions>"
    }},
    "completeness": {{
        "score": <0.0-10.0>,
        "explanation": "<detailed explanation>",
        "feedback": "<specific improvement suggestions>"
    }},
    "efficiency": {{
        "score": <0.0-10.0>,
        "explanation": "<detailed explanation>",
        "feedback": "<specific improvement suggestions>"
    }},
    "general_feedback": "<overall assessment and key insights>",
    "recommendations": [
        "<specific recommendation 1>",
        "<specific recommendation 2>",
        "<specific recommendation 3>"
    ]
}}
```

Focus on being constructive and specific in your feedback. Consider both what was done well and what could be improved."#,
            criteria_description = criteria_description,
            user_request = chain.user_request,
            chain_summary = chain_summary,
            final_response = chain.final_response
        )
    }
    
    /// Describe the evaluation criteria
    fn describe_criteria(&self) -> String {
        format!(
            r#"1. **Reasoning Quality** (Weight: {:.1}%): How logical, coherent, and well-structured is the reasoning process?
2. **Tool Usage** (Weight: {:.1}%): How appropriately and effectively are tools selected and used?
3. **Relevance** (Weight: {:.1}%): How well does the response address the user's specific request?
4. **Completeness** (Weight: {:.1}%): Does the response fully answer the question and provide necessary information?
5. **Efficiency** (Weight: {:.1}%): Is the reasoning process efficient without unnecessary steps or redundancy?"#,
            self.config.criteria.reasoning_weight * 100.0,
            self.config.criteria.tool_usage_weight * 100.0,
            self.config.criteria.relevance_weight * 100.0,
            self.config.criteria.completeness_weight * 100.0,
            self.config.criteria.efficiency_weight * 100.0
        )
    }
    
    /// Summarize the ReAct chain for evaluation
    fn summarize_chain(&self, chain: &ReActChain) -> String {
        let mut summary = String::new();
        
        for (i, step) in chain.steps.iter().enumerate() {
            summary.push_str(&format!("\n### Step {} - {:?}\n", i + 1, step.step_type));
            summary.push_str(&format!("**Content**: {}\n", step.content));
            
            if let Some(tool_call) = &step.tool_call {
                summary.push_str(&format!("**Tool Used**: {}\n", tool_call.name));
                if !tool_call.args.is_empty() {
                    summary.push_str(&format!("**Tool Args**: {:?}\n", tool_call.args));
                }
            }
            
            if let Some(tool_result) = &step.tool_result {
                summary.push_str(&format!("**Tool Result**: {} - {}\n", 
                    if tool_result.success { "Success" } else { "Failed" },
                    tool_result.message
                ));
            }
            
            if let Some(duration) = step.duration_ms {
                summary.push_str(&format!("**Duration**: {}ms\n", duration));
            }
        }
        
        summary.push_str(&format!("\n**Total Steps**: {}\n", chain.steps.len()));
        summary.push_str(&format!("**Total Iterations**: {}\n", chain.iterations));
        
        if let Some(total_duration) = chain.total_duration_ms {
            summary.push_str(&format!("**Total Duration**: {}ms\n", total_duration));
        }
        
        summary
    }
    
    /// Parse the judge's response into a structured evaluation
    fn parse_judge_response(
        &self,
        chain: &ReActChain,
        response: &str,
        judge_provider: &dyn LLMProvider,
    ) -> AIResult<JudgeEvaluation> {
        // Extract JSON from the response
        let json_str = self.extract_json_from_response(response)?;
        
        // Parse the JSON response
        let parsed: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| AIServiceError::validation_error(format!("Failed to parse judge response: {}", e)))?;
        
        // Extract individual scores
        let reasoning_quality = self.parse_aspect_score(&parsed, "reasoning_quality")?;
        let tool_usage = self.parse_aspect_score(&parsed, "tool_usage")?;
        let relevance = self.parse_aspect_score(&parsed, "relevance")?;
        let completeness = self.parse_aspect_score(&parsed, "completeness")?;
        let efficiency = self.parse_aspect_score(&parsed, "efficiency")?;
        
        // Calculate overall score
        let overall_score = self.calculate_overall_score(
            &reasoning_quality,
            &tool_usage,
            &relevance,
            &completeness,
            &efficiency,
        );
        
        // Extract general feedback and recommendations
        let general_feedback = parsed.get("general_feedback")
            .and_then(|v| v.as_str())
            .unwrap_or("No general feedback provided")
            .to_string();
        
        let recommendations = parsed.get("recommendations")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_else(Vec::new);
        
        Ok(JudgeEvaluation {
            id: uuid::Uuid::new_v4().to_string(),
            chain_id: chain.id.clone(),
            overall_score,
            reasoning_quality,
            tool_usage,
            relevance,
            completeness,
            efficiency,
            general_feedback,
            recommendations,
            evaluated_at: Utc::now(),
            judge_model: judge_provider.get_model_info().name,
            metadata: HashMap::new(),
        })
    }
    
    /// Extract JSON from the judge's response
    fn extract_json_from_response(&self, response: &str) -> AIResult<String> {
        // Look for JSON block markers
        if let Some(start) = response.find("```json") {
            let json_start = start + 7; // Length of "```json"
            if let Some(end_pos) = response[json_start..].find("```") {
                let json_end = json_start + end_pos;
                return Ok(response[json_start..json_end].trim().to_string());
            }
        }
        
        // Look for JSON object markers
        if let Some(start) = response.find('{') {
            if let Some(end) = response.rfind('}') {
                if end > start {
                    return Ok(response[start..=end].to_string());
                }
            }
        }
        
        Err(AIServiceError::validation_error("No valid JSON found in judge response".to_string()))
    }
    
    /// Parse an aspect score from the JSON response
    fn parse_aspect_score(&self, json: &serde_json::Value, aspect: &str) -> AIResult<AspectScore> {
        let aspect_obj = json.get(aspect)
            .ok_or_else(|| AIServiceError::validation_error(format!("Missing aspect: {}", aspect)))?;
        
        let score = aspect_obj.get("score")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| AIServiceError::validation_error(format!("Missing or invalid score for {}", aspect)))?;
        
        let explanation = aspect_obj.get("explanation")
            .and_then(|v| v.as_str())
            .unwrap_or("No explanation provided")
            .to_string();
        
        let feedback = aspect_obj.get("feedback")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        // Validate score range
        let score = score.max(0.0).min(10.0);
        
        Ok(AspectScore {
            score,
            explanation,
            feedback,
        })
    }
    
    /// Calculate the overall weighted score
    fn calculate_overall_score(
        &self,
        reasoning: &AspectScore,
        tool_usage: &AspectScore,
        relevance: &AspectScore,
        completeness: &AspectScore,
        efficiency: &AspectScore,
    ) -> f64 {
        let weighted_score = 
            reasoning.score * self.config.criteria.reasoning_weight +
            tool_usage.score * self.config.criteria.tool_usage_weight +
            relevance.score * self.config.criteria.relevance_weight +
            completeness.score * self.config.criteria.completeness_weight +
            efficiency.score * self.config.criteria.efficiency_weight;
        
        // Ensure the score is within bounds
        weighted_score.max(0.0).min(10.0)
    }
    
    /// Substitute variables in a custom prompt template
    fn substitute_prompt_variables(&self, template: &str, chain: &ReActChain) -> String {
        template
            .replace("{user_request}", &chain.user_request)
            .replace("{final_response}", &chain.final_response)
            .replace("{chain_summary}", &self.summarize_chain(chain))
            .replace("{criteria_description}", &self.describe_criteria())
            .replace("{step_count}", &chain.steps.len().to_string())
            .replace("{iteration_count}", &chain.iterations.to_string())
    }
    
    /// Evaluate multiple chains and return comparative analysis
    pub async fn evaluate_multiple_chains(
        &self,
        chains: &[ReActChain],
        judge_provider: &dyn LLMProvider,
    ) -> AIResult<Vec<JudgeEvaluation>> {
        let mut evaluations = Vec::new();
        
        for chain in chains {
            let evaluation = self.evaluate_chain(chain, judge_provider).await?;
            evaluations.push(evaluation);
        }
        
        Ok(evaluations)
    }
    
    /// Generate a comparative report for multiple evaluations
    pub fn generate_comparative_report(&self, evaluations: &[JudgeEvaluation]) -> String {
        if evaluations.is_empty() {
            return "No evaluations to compare".to_string();
        }
        
        let mut report = String::new();
        report.push_str("# ReAct Chain Evaluation Report\n\n");
        
        // Summary statistics
        let avg_score = evaluations.iter().map(|e| e.overall_score).sum::<f64>() / evaluations.len() as f64;
        let best_score = evaluations.iter().map(|e| e.overall_score).fold(0.0, f64::max);
        let worst_score = evaluations.iter().map(|e| e.overall_score).fold(10.0, f64::min);
        
        report.push_str(&format!("## Summary\n"));
        report.push_str(&format!("- **Total Evaluations**: {}\n", evaluations.len()));
        report.push_str(&format!("- **Average Score**: {:.2}/10.0\n", avg_score));
        report.push_str(&format!("- **Best Score**: {:.2}/10.0\n", best_score));
        report.push_str(&format!("- **Worst Score**: {:.2}/10.0\n", worst_score));
        report.push_str("\n");
        
        // Individual evaluations
        report.push_str("## Individual Evaluations\n\n");
        for (i, eval) in evaluations.iter().enumerate() {
            report.push_str(&format!("### Evaluation {} (Score: {:.2}/10.0)\n", i + 1, eval.overall_score));
            report.push_str(&format!("- **Chain ID**: {}\n", eval.chain_id));
            report.push_str(&format!("- **Reasoning**: {:.1}/10.0\n", eval.reasoning_quality.score));
            report.push_str(&format!("- **Tool Usage**: {:.1}/10.0\n", eval.tool_usage.score));
            report.push_str(&format!("- **Relevance**: {:.1}/10.0\n", eval.relevance.score));
            report.push_str(&format!("- **Completeness**: {:.1}/10.0\n", eval.completeness.score));
            report.push_str(&format!("- **Efficiency**: {:.1}/10.0\n", eval.efficiency.score));
            report.push_str(&format!("- **Feedback**: {}\n", eval.general_feedback));
            report.push_str("\n");
        }
        
        report
    }
}

impl Default for LLMJudge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::react_engine::{ReActStep, ReActStepType, ToolCall, ToolResult};
    use std::collections::HashMap;
    
    fn create_test_chain() -> ReActChain {
        let mut chain = ReActChain {
            id: "test-chain-1".to_string(),
            user_request: "List my tasks".to_string(),
            steps: vec![],
            final_response: "Here are your tasks: Task 1, Task 2".to_string(),
            completed: true,
            iterations: 2,
            started_at: Utc::now(),
            completed_at: Some(Utc::now()),
            total_duration_ms: Some(500),
            metadata: HashMap::new(),
        };
        
        // Add a thought step
        chain.steps.push(ReActStep {
            id: "step-1".to_string(),
            step_type: ReActStepType::Thought,
            content: "I need to get the user's tasks".to_string(),
            tool_call: None,
            tool_result: None,
            timestamp: Utc::now(),
            duration_ms: Some(100),
            metadata: HashMap::new(),
        });
        
        // Add an action step
        chain.steps.push(ReActStep {
            id: "step-2".to_string(),
            step_type: ReActStepType::Action,
            content: "Action: get_tasks".to_string(),
            tool_call: Some(ToolCall {
                name: "get_tasks".to_string(),
                args: HashMap::new(),
                id: "tool-call-1".to_string(),
            }),
            tool_result: Some(ToolResult {
                success: true,
                data: serde_json::json!({"tasks": ["Task 1", "Task 2"]}),
                message: "Retrieved tasks successfully".to_string(),
                execution_time_ms: 200,
                error: None,
            }),
            timestamp: Utc::now(),
            duration_ms: Some(300),
            metadata: HashMap::new(),
        });
        
        chain
    }
    
    #[test]
    fn test_judge_creation() {
        let judge = LLMJudge::new();
        assert_eq!(judge.config.criteria.reasoning_weight, 0.25);
        
        let custom_config = JudgeConfig {
            criteria: EvaluationCriteria {
                reasoning_weight: 0.5,
                ..Default::default()
            },
            ..Default::default()
        };
        
        let custom_judge = LLMJudge::with_config(custom_config);
        assert_eq!(custom_judge.config.criteria.reasoning_weight, 0.5);
    }
    
    #[test]
    fn test_chain_summarization() {
        let judge = LLMJudge::new();
        let chain = create_test_chain();
        let summary = judge.summarize_chain(&chain);
        
        assert!(summary.contains("Step 1 - Thought"));
        assert!(summary.contains("Step 2 - Action"));
        assert!(summary.contains("get_tasks"));
        assert!(summary.contains("Total Steps: 2"));
    }
    
    #[test]
    fn test_json_extraction() {
        let judge = LLMJudge::new();
        
        let response_with_markers = r#"Here's my evaluation:
```json
{"score": 8.5, "explanation": "Good reasoning"}
```
That's my assessment."#;
        
        let extracted = judge.extract_json_from_response(response_with_markers).unwrap();
        assert!(extracted.contains("score"));
        assert!(extracted.contains("8.5"));
        
        let response_with_braces = r#"My evaluation: {"score": 7.0, "explanation": "Decent work"} - done."#;
        let extracted2 = judge.extract_json_from_response(response_with_braces).unwrap();
        assert!(extracted2.contains("score"));
        assert!(extracted2.contains("7.0"));
    }
    
    #[test]
    fn test_score_calculation() {
        let judge = LLMJudge::new();
        
        let reasoning = AspectScore { score: 8.0, explanation: "Good".to_string(), feedback: None };
        let tool_usage = AspectScore { score: 7.0, explanation: "OK".to_string(), feedback: None };
        let relevance = AspectScore { score: 9.0, explanation: "Excellent".to_string(), feedback: None };
        let completeness = AspectScore { score: 6.0, explanation: "Partial".to_string(), feedback: None };
        let efficiency = AspectScore { score: 8.0, explanation: "Good".to_string(), feedback: None };
        
        let overall = judge.calculate_overall_score(&reasoning, &tool_usage, &relevance, &completeness, &efficiency);
        
        // Should be weighted average: 8.0*0.25 + 7.0*0.20 + 9.0*0.25 + 6.0*0.20 + 8.0*0.10 = 7.45
        assert!((overall - 7.45).abs() < 0.01);
    }
}