import Cors from 'cors';
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { z } from 'zod';

import { ApiError, ApiErrorType } from '@chaindesk/lib/api-error';
import { BlablaSchema } from '@chaindesk/lib/blablaform';
import { createApiHandler, respond } from '@chaindesk/lib/createa-api-handler';
import runMiddleware from '@chaindesk/lib/run-middleware';
import { AppNextApiRequest } from '@chaindesk/lib/types';
import validate from '@chaindesk/lib/validate';
import { prisma } from '@chaindesk/prisma/client';

const handler = createApiHandler();

const validationSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.any()),
  required: z.array(z.string()),
});

const referenceSchema = {
  type: 'object',
  properties: {
    firstFieldName: {
      type: 'string',
      format: 'email',
    },
    secondFieldName: {
      type: 'number',
    },
  },
  required: ['firstFieldName'],
} satisfies BlablaSchema;

const cors = Cors({
  methods: ['POST', 'HEAD'],
});

// publish the draftconfig -> turn them into a schema first then update publishConfig
export const publishForm = async (
  req: AppNextApiRequest,
  res: NextApiResponse
) => {
  const formId = req.query.formId as string;
  const found = await prisma.form.findUnique({
    where: {
      id: formId,
    },
    select: {
      draftConfig: true,
    },
  });

  if (!found) {
    throw new ApiError(ApiErrorType.NOT_FOUND);
  }
  const fields = (found?.draftConfig as any)?.fields;

  if (!fields) {
    throw new Error('Must register at least one ield');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const _systemPrompt = `I'm designing a form and need a direct, parsable JSON schema for the following field names: ${JSON.stringify(
    fields
  )}, Based on common conventions and best practices and on this reference schema ${JSON.stringify(
    referenceSchema
  )}, please provide a direct JSON schema specific to these inputs without any additional explanations, formatting, comments, or the "$schema" property.`;

  // should only be called when we publish, update publishedConfig
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: _systemPrompt,
      },
    ],
    stream: false,
  });
  const schema = JSON.parse(response?.choices?.[0]?.message.content!);
  const validationResult = validationSchema.safeParse(schema);

  if (validationResult.success) {
    await prisma.form.update({
      where: {
        id: formId,
      },
      data: {
        publishedConfig: schema,
      },
    });
  }

  // TODO: add publish form-to-url logic
  return response?.choices?.[0]?.message;
};

handler.post(respond(publishForm));

export default async function wrapper(
  req: AppNextApiRequest,
  res: NextApiResponse
) {
  await runMiddleware(req, res, cors);

  return handler(req, res);
}
