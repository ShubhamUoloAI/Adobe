import OpenAI from 'openai';
import config from '../config/config.js';
import fs from 'fs';

let openai = null;

/**
 * Initialize OpenAI client
 */
function initializeOpenAI() {
  if (!openai && config.openai.apiKey) {
    openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
  return openai;
}

/**
 * Compare two PDF texts using OpenAI
 * @param {string} text1 - First PDF text
 * @param {string} text2 - Second PDF text
 * @param {string} filename1 - First file name
 * @param {string} filename2 - Second file name
 * @returns {Promise<Object>} - Comparison result
 */
export async function comparePDFTexts(text1, text2, filename1, filename2) {
  try {
    const client = initializeOpenAI();

    if (!client) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.');
    }

    // Truncate texts if too long (to stay within token limits)
    const maxChars = 50000;
    const truncatedText1 = text1.length > maxChars ? text1.substring(0, maxChars) + '...[truncated]' : text1;
    const truncatedText2 = text2.length > maxChars ? text2.substring(0, maxChars) + '...[truncated]' : text2;

    const prompt = `Compare these two PDF documents and provide a detailed analysis.

Document 1 (${filename1}):
${truncatedText1}

Document 2 (${filename2}):
${truncatedText2}

Analyze and return a JSON response with:
1. identical: boolean (are they exactly the same?)
2. similarity: number (0-100, percentage similarity)
3. differences: object with:
   - additions: array of strings (new content in document 2 not in document 1)
   - deletions: array of strings (content in document 1 removed in document 2)
   - modifications: array of strings (changed content between documents)
4. summary: string (brief summary of comparison in 2-3 sentences)

Return ONLY valid JSON, no markdown formatting or extra text.`;

    const response = await client.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a document comparison expert. Compare documents thoroughly and return structured JSON responses. Focus on meaningful differences, not minor formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    return {
      file1: filename1,
      file2: filename2,
      identical: result.identical || false,
      similarity: result.similarity || 0,
      differences: result.differences || { additions: [], deletions: [], modifications: [] },
      summary: result.summary || 'Comparison completed'
    };

  } catch (error) {
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your account.');
    } else if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    } else {
      throw new Error(`OpenAI comparison failed: ${error.message}`);
    }
  }
}

/**
 * Generate a summary of all comparisons
 * @param {Array} comparisons - Array of comparison results
 * @param {Array} fileNames - Array of all file names
 * @returns {Promise<string>} - Overall summary
 */
export async function generateComparisonSummary(comparisons, fileNames) {
  try {
    const client = initializeOpenAI();

    if (!client) {
      return createFallbackSummary(comparisons, fileNames);
    }

    const comparisonSummaries = comparisons.map(comp =>
      `${comp.file1} vs ${comp.file2}: ${comp.similarity}% similar - ${comp.summary}`
    ).join('\n');

    const prompt = `Given these PDF comparison results, provide a concise overall summary (2-3 sentences):

Files compared: ${fileNames.join(', ')}

Individual comparisons:
${comparisonSummaries}

Summarize the overall findings, identifying groups of identical files and highlighting major differences.`;

    const response = await client.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a document comparison expert. Provide clear, concise summaries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 300
    });

    return response.choices[0].message.content.trim();

  } catch (error) {
    console.error('Error generating summary with OpenAI:', error.message);
    return createFallbackSummary(comparisons, fileNames);
  }
}

/**
 * Create a fallback summary without using OpenAI
 * @param {Array} comparisons - Array of comparison results
 * @param {Array} fileNames - Array of all file names
 * @returns {string} - Fallback summary
 */
function createFallbackSummary(comparisons, fileNames) {
  const totalFiles = fileNames.length;
  const identicalPairs = comparisons.filter(c => c.identical).length;
  const totalPairs = comparisons.length;

  if (identicalPairs === totalPairs) {
    return `All ${totalFiles} documents are identical.`;
  } else if (identicalPairs === 0) {
    return `${totalFiles} documents compared. All documents have differences.`;
  } else {
    const avgSimilarity = Math.round(
      comparisons.reduce((sum, c) => sum + c.similarity, 0) / totalPairs
    );
    return `${totalFiles} documents compared with ${avgSimilarity}% average similarity. ${identicalPairs} of ${totalPairs} pairs are identical.`;
  }
}

/**
 * Compare PDFs directly by uploading them to OpenAI and using Assistants API
 * @param {Array<{path: string, originalname: string}>} pdfFiles - Array of uploaded PDF files
 * @returns {Promise<Object>} - Comparison results
 */
export async function comparePDFsDirectly(pdfFiles) {
  let assistant = null;
  let thread = null;
  const uploadedFileIds = [];
  let client = null;

  try {
    client = initializeOpenAI();

    if (!client) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.');
    }

    console.log(`[OpenAI] Uploading ${pdfFiles.length} PDFs to OpenAI...`);

    // Upload PDFs to OpenAI
    const uploadedFiles = await Promise.all(
      pdfFiles.map(async (file) => {
        try {
          const uploadedFile = await client.files.create({
            file: fs.createReadStream(file.path),
            purpose: 'assistants'
          });
          uploadedFileIds.push(uploadedFile.id);

          return {
            id: uploadedFile.id,
            filename: file.originalname
          };
        } catch (error) {
          console.error(`[OpenAI] Error uploading ${file.originalname}:`, error.message);
          throw new Error(`Failed to upload ${file.originalname}: ${error.message}`);
        }
      })
    );

    console.log('[OpenAI] Files uploaded. Creating assistant for PDF comparison...');

    // Create an assistant with file search capability
    assistant = await client.beta.assistants.create({
      name: 'PDF Comparison Assistant',
      instructions: `You are an expert document comparison assistant. Your task is to compare PDF documents and provide detailed analysis of their similarities and differences. Focus on content, structure, and meaningful changes.`,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }]
    });

    // Create a thread for the comparison
    thread = await client.beta.threads.create();

    // If there are only 2 PDFs, do a direct comparison
    if (pdfFiles.length === 2) {
      const comparison = await compareTwoPDFsWithAssistant(
        client,
        assistant.id,
        thread.id,
        uploadedFiles[0],
        uploadedFiles[1]
      );

      return {
        totalFiles: 2,
        pairwiseComparisons: [comparison],
        identicalGroups: comparison.identical ? [[uploadedFiles[0].filename, uploadedFiles[1].filename]] : [],
        summary: comparison.summary
      };
    }

    // For more than 2 PDFs, do pairwise comparisons
    const comparisons = [];
    const identicalPairs = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      for (let j = i + 1; j < uploadedFiles.length; j++) {
        const comparison = await compareTwoPDFsWithAssistant(
          client,
          assistant.id,
          thread.id,
          uploadedFiles[i],
          uploadedFiles[j]
        );
        comparisons.push(comparison);

        if (comparison.identical) {
          identicalPairs.push([uploadedFiles[i].filename, uploadedFiles[j].filename]);
        }
      }
    }

    // Group identical files together
    const identicalGroups = groupIdenticalFiles(identicalPairs, pdfFiles.map(f => f.originalname));

    // Generate overall summary
    const overallSummary = await generateAssistantComparisonSummary(
      client,
      comparisons,
      pdfFiles.map(f => f.originalname)
    );

    return {
      totalFiles: pdfFiles.length,
      pairwiseComparisons: comparisons,
      identicalGroups,
      summary: overallSummary
    };

  } catch (error) {
    console.error('[OpenAI] PDF comparison error:', error);

    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your account.');
    } else if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    } else {
      throw new Error(`PDF comparison failed: ${error.message}`);
    }
  } finally {
    // Cleanup: Delete assistant, thread, and uploaded files
    try {
      if (assistant) {
        await client.beta.assistants.del(assistant.id);
        console.log('[OpenAI] Assistant deleted');
      }
      if (thread) {
        await client.beta.threads.del(thread.id);
        console.log('[OpenAI] Thread deleted');
      }
      for (const fileId of uploadedFileIds) {
        await client.files.del(fileId);
        console.log(`[OpenAI] File ${fileId} deleted`);
      }
    } catch (cleanupError) {
      console.error('[OpenAI] Cleanup error:', cleanupError.message);
    }
  }
}

/**
 * Compare two PDFs using OpenAI Assistants API
 * @param {OpenAI} client - OpenAI client
 * @param {string} assistantId - Assistant ID
 * @param {string} threadId - Thread ID
 * @param {Object} pdf1 - First PDF file info
 * @param {Object} pdf2 - Second PDF file info
 * @returns {Promise<Object>} - Comparison result
 */
async function compareTwoPDFsWithAssistant(client, assistantId, threadId, pdf1, pdf2) {
  try {
    const prompt = `Compare these two PDF documents:
1. File ID: ${pdf1.id}, Name: "${pdf1.filename}"
2. File ID: ${pdf2.id}, Name: "${pdf2.filename}"

Analyze both documents thoroughly and provide a detailed comparison in JSON format with:
1. identical: boolean (are they exactly the same in content?)
2. similarity: number (0-100, estimated percentage similarity)
3. differences: object with:
   - additions: array of strings (new content in document 2 not in document 1)
   - deletions: array of strings (content in document 1 removed in document 2)
   - modifications: array of strings (changed content between documents)
4. summary: string (brief summary of comparison in 2-3 sentences)

Return ONLY valid JSON, no markdown formatting or extra text.`;

    // Add message to thread with file attachments
    await client.beta.threads.messages.create(threadId, {
      role: 'user',
      content: prompt,
      attachments: [
        { file_id: pdf1.id, tools: [{ type: 'file_search' }] },
        { file_id: pdf2.id, tools: [{ type: 'file_search' }] }
      ]
    });

    // Run the assistant
    const run = await client.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
      response_format: { type: 'json_object' }
    });

    if (run.status === 'completed') {
      const messages = await client.beta.threads.messages.list(threadId);
      let assistantMessage = messages.data[0].content[0].text.value;

      // Strip markdown code blocks if present
      assistantMessage = assistantMessage.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const result = JSON.parse(assistantMessage);

      return {
        file1: pdf1.filename,
        file2: pdf2.filename,
        identical: result.identical || false,
        similarity: result.similarity || 0,
        differences: result.differences || { additions: [], deletions: [], modifications: [] },
        summary: result.summary || 'Comparison completed'
      };
    } else {
      throw new Error(`Assistant run failed with status: ${run.status}`);
    }

  } catch (error) {
    console.error(`[OpenAI] Error comparing ${pdf1.filename} vs ${pdf2.filename}:`, error.message);
    throw error;
  }
}

/**
 * Generate summary for assistant-based comparisons
 * @param {OpenAI} client - OpenAI client
 * @param {Array} comparisons - Array of comparison results
 * @param {Array} fileNames - Array of file names
 * @returns {Promise<string>} - Overall summary
 */
async function generateAssistantComparisonSummary(client, comparisons, fileNames) {
  try {
    const comparisonSummaries = comparisons.map(comp =>
      `${comp.file1} vs ${comp.file2}: ${comp.similarity}% similar - ${comp.summary}`
    ).join('\n');

    const prompt = `Given these PDF comparison results, provide a concise overall summary (2-3 sentences):

Files compared: ${fileNames.join(', ')}

Individual comparisons:
${comparisonSummaries}

Summarize the overall findings, identifying groups of identical files and highlighting major differences.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a document comparison expert. Provide clear, concise summaries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 300
    });

    return response.choices[0].message.content.trim();

  } catch (error) {
    console.error('[OpenAI] Error generating summary:', error.message);
    return createFallbackSummary(comparisons, fileNames);
  }
}

/**
 * Group identical files together based on pairwise comparisons
 * @param {Array<Array<string>>} identicalPairs - Array of identical file pairs
 * @param {Array<string>} allFiles - All file names
 * @returns {Array<Array<string>>} - Groups of identical files
 */
function groupIdenticalFiles(identicalPairs, allFiles) {
  if (identicalPairs.length === 0) {
    return [];
  }

  const groups = [];
  const processed = new Set();

  identicalPairs.forEach(([file1, file2]) => {
    if (processed.has(file1) || processed.has(file2)) {
      // Find existing group and add to it
      const existingGroup = groups.find(g => g.includes(file1) || g.includes(file2));
      if (existingGroup) {
        if (!existingGroup.includes(file1)) existingGroup.push(file1);
        if (!existingGroup.includes(file2)) existingGroup.push(file2);
      }
    } else {
      // Create new group
      groups.push([file1, file2]);
      processed.add(file1);
      processed.add(file2);
    }
  });

  return groups;
}
