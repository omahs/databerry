/*
    package that allows to create conversational forms with Generative AI
    input json schema -> AI ask questions until form is valid -> output json
*/
import { JSONSchema7 } from 'json-schema';
import OpenAI from 'openai';
import {
  ChatCompletionChunk,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
} from 'openai/resources/chat';
import pRetry from 'p-retry';

import { BlablaSchema } from './blablaform.types';

const defaultSystemPrompt = `You role is too help fill a form that follows a JSON Schema. You will ask questions in natural language, one at a time, to the user and fill the form. Use a friendly and energetic tone. You are able to go back to previous questions if asked.`;

function messageReducer(
  previous: ChatCompletionMessage,
  item: ChatCompletionChunk
): ChatCompletionMessage {
  const reduce = (acc: any, delta: any) => {
    acc = { ...acc };
    for (const [key, value] of Object.entries(delta)) {
      if (acc[key] === undefined || acc[key] === null) {
        acc[key] = value;
      } else if (typeof acc[key] === 'string' && typeof value === 'string') {
        (acc[key] as string) += value;
      } else if (typeof acc[key] === 'object' && !Array.isArray(acc[key])) {
        acc[key] = reduce(acc[key], value);
      }
    }
    return acc;
  };

  return reduce(previous, item.choices[0]!.delta) as ChatCompletionMessage;
}

const handleValidForm = (formValues: Record<string, unknown>) => {
  return formValues;
};

async function callFunction(
  function_call: ChatCompletionMessage.FunctionCall
): Promise<any> {
  const args = JSON.parse(function_call.arguments!);
  switch (function_call.name) {
    case 'isFormValid':
      return await handleValidForm(args);
    default:
      throw new Error('No function found');
  }
}

export class BlaBlaForm {
  schema: BlablaSchema;
  values: object;
  modelName: string;
  messages: ChatCompletionMessageParam[];
  systemPrompt?: string;
  locale?: string;
  handleLLMNewToken?: (token: string) => any;

  constructor({
    schema,
    values = {},
    modelName = 'gpt-3.5-turbo',
    messages = [],
    systemPrompt = defaultSystemPrompt,
    locale = 'en',
    handleLLMNewToken,
  }: {
    schema: BlablaSchema;
    values?: Record<string, unknown>;
    modelName?: string;
    messages?: ChatCompletionMessageParam[];
    systemPrompt?: string;
    locale?: string;
    handleLLMNewToken?: (token: string) => any;
  }) {
    this.schema = schema;
    this.values = values;
    this.modelName = modelName;
    this.locale = locale;
    this.handleLLMNewToken = handleLLMNewToken;
    const _systemPrompt = `${systemPrompt}\nWrite in the language of the following locale: ${locale}${
      values
        ? `Use the following values to fill the form ask questions about the remaining missing ones:  ${Object.keys(
            values
          )
            .map((key) => `${key}: ${values[key]}`)
            .join(', ')}`
        : ``
    }`;
    this.systemPrompt = _systemPrompt;
    this.messages = [
      {
        role: 'system',
        content: _systemPrompt,
      },
      ...messages,
    ];
  }

  static async blabla({
    schema,
    modelName,
    messages,
    handleLLMNewToken,
  }: {
    schema: BlablaSchema;
    modelName: string;
    messages: ChatCompletionMessageParam[];
    handleLLMNewToken?: (token: string) => any;
  }) {
    // return pRetry(
    //   async () => {
    //     try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const isStreamEnabled = Boolean(handleLLMNewToken);

    if (isStreamEnabled) {
      // let response: Omit<OpenAIClient.Completion, "choices"> | undefined;
      console.log('CALLELD --------------------------->');

      const stream = await openai.chat.completions.create({
        model: modelName,
        messages,
        stream: true,
        functions: [
          {
            name: 'isFormValid',
            description:
              'Trigger only when all the required field have been answered',
            parameters: schema,
          },
          // {
          //   name: 'getFormValues',
          //   description:
          //     'Use this function to extract values from the conversation along with the completion',
          //   parameters: schema,
          // },
        ],
      });

      let completion = {} as ChatCompletionMessage;
      let hasStreamedOnce = false;
      for await (const chunk of stream) {
        completion = messageReducer(completion, chunk);
        console.log('TEST ------------------>', completion);

        if (completion.function_call) {
          if (!hasStreamedOnce) {
            handleLLMNewToken?.('Thinking ....');
            hasStreamedOnce = true;
          }
        } else {
          handleLLMNewToken?.(chunk?.choices?.[0]?.delta?.content!);
        }
      }

      if (completion?.function_call?.name === 'isFormValid') {
        // const values = await callFunction(completion.function_call);

        const values = JSON.parse(completion?.function_call.arguments!);
        handleLLMNewToken?.(`\n${JSON.stringify(values)}`);

        return {
          answer: JSON.stringify(values),
          isValid: !!values,
          values,
        };
      }

      return {
        answer: completion.content,
        isValid: false,
        values: undefined,
      };
    } else {
      const completion = await openai.chat.completions.create({
        model: modelName,
        messages,
        stream: false,
        functions: [
          {
            name: 'isFormValid',
            description:
              'Trigger only when all the required field have been answered',
            parameters: schema,
          },
          // {
          //   name: 'getFormValues',
          //   description:
          //     'Use this function to extract values from the conversation along with the completion',
          //   parameters: schema,
          // },
        ],
      });
      const message = completion?.choices?.[0]?.message;

      return {
        answer: message,
        isValid:
          (completion as any)?.choices[0].message?.function_call?.name ===
          'isFormValid',
        values:
          (completion as any)?.choices[0].message?.function_call?.name ===
          'isFormValid',
      };
    }
    //     } catch (err) {
    //       setTimeout(() => {
    //         throw err;
    //       }, 1000);
    //     }
    //   },
    //   {
    //     retries: 0,
    //   }
    // );
  }

  async run(query?: string) {
    if (query) {
      this.messages.push({
        role: 'user',
        content: query,
      });
    }

    const { answer, isValid, values } = await BlaBlaForm.blabla({
      schema: this.schema,
      messages: this.messages,
      modelName: this.modelName,
      handleLLMNewToken: this.handleLLMNewToken,
    });

    console.log('RECEIVED ANSWER', answer);

    this.messages.push({
      role: 'assistant',
      content: answer as string,
    });

    return {
      answer,
      isValid,
      values,
    };
  }
}
