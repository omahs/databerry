import Cors from 'cors';
import cuid from 'cuid';
import { NextApiRequest, NextApiResponse } from 'next';

import { ApiError, ApiErrorType } from '@chaindesk/lib/api-error';
import { BlaBlaForm, BlablaSchema } from '@chaindesk/lib/blablaform';
import ChainManager from '@chaindesk/lib/chains';
import ConversationManager from '@chaindesk/lib/conversation';
import {
  createApiHandler,
  createAuthApiHandler,
} from '@chaindesk/lib/createa-api-handler';
import guardAgentQueryUsage from '@chaindesk/lib/guard-agent-query-usage';
import runMiddleware from '@chaindesk/lib/run-middleware';
import streamData from '@chaindesk/lib/stream-data';
import { AppNextApiRequest, SSE_EVENT } from '@chaindesk/lib/types';
import {
  ChatRequest,
  FormChatRequest,
  RunChainRequest,
} from '@chaindesk/lib/types/dtos';
import validate from '@chaindesk/lib/validate';
import {
  ConversationChannel,
  FormStatus,
  Message,
  MessageFrom,
  Usage,
} from '@chaindesk/prisma';
import { prisma } from '@chaindesk/prisma/client';

const handler = createApiHandler();

/*

*/

const cors = Cors({
  methods: ['POST', 'HEAD'],
});

export const formSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
    },
    country: {
      type: 'string',
    },
  },
  required: ['email'],
} satisfies BlablaSchema;

const queryForm = async ({
  input,
  stream,
  history,
  temperature,
  filters,
  httpResponse,
  abortController,
}: {
  input: string;
  stream?: any;
  history?: Message[] | undefined;
  temperature?: ChatRequest['temperature'];
  filters?: ChatRequest['filters'];
  promptType?: ChatRequest['promptType'];
  promptTemplate?: ChatRequest['promptTemplate'];
  httpResponse?: any;
  abortController?: any;
}) => {
  // TODO:  get the form schema from the database.

  const form = new BlaBlaForm({
    schema: formSchema,
    handleLLMNewToken: stream,
    messages: history?.map((each) => ({
      content: each.text,
      role: each.from === MessageFrom.agent ? 'assistant' : 'user',
    })),
  });

  return form.run(input);
};

export const formChat = async (
  req: AppNextApiRequest,
  res: NextApiResponse
) => {
  const session = req.session;
  const data = req.body as FormChatRequest;

  // TODO: Remove this, conversation Id should come from the form id
  const conversationId = data.conversationId! || cuid();

  // guardAgentQueryUsage({
  //   usage: session?.organization?.usage,
  //   plan: session?.organization?.currentPlan,
  // });

  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },
    include: {
      messages: {
        // take: -10,
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  console.log(conversation?.messages);

  const manager = new ChainManager({});
  const ctrl = new AbortController();

  if (data.streaming) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    req.socket.on('close', function () {
      ctrl.abort();
    });
  }

  const conversationManager = new ConversationManager({
    formId: data.formId,
    channel: ConversationChannel.dashboard,
    // agentId: agent?.id,
    // userId: session?.user?.id,
    visitorId: data.visitorId!,
    conversationId,
  });

  conversationManager.push({
    from: MessageFrom.human,
    text: data.query,
  });

  const handleStream = (data: string) => {
    if (data) {
      streamData({
        event: SSE_EVENT.answer,
        data,
        res,
      });
    }
  };

  const chatRes = await queryForm({
    input: data.query,
    stream: data.streaming ? handleStream : undefined,
    history: conversation?.messages,
    temperature: data.temperature,
    promptTemplate: data.promptTemplate,
    promptType: data.promptType,
    filters: data.filters,
    httpResponse: res,
    abortController: ctrl,
  });

  const answerMsgId = cuid();

  conversationManager.formtStatus = chatRes.isValid
    ? FormStatus.COMPLETED
    : FormStatus.IN_PROGRESS;

  conversationManager.push({
    id: answerMsgId,
    from: MessageFrom.agent,
    text: chatRes.answer as string,
    sources: [],
  });

  // TODO: save Message
  await conversationManager.save();

  if (data.streaming) {
    streamData({
      event: SSE_EVENT.endpoint_response,
      data: JSON.stringify({
        messageId: answerMsgId,
        answer: chatRes.answer,
        sources: [],
        conversationId: conversationManager.conversationId,
        visitorId: conversationManager.visitorId,
      }),
      res,
    });

    streamData({
      data: '[DONE]',
      res,
    });
  } else {
    return {
      ...chatRes,
      messageId: answerMsgId,
      conversationId: conversationManager.conversationId,
      visitorId: conversationManager.visitorId,
    };
  }
};

handler.post(
  validate({
    handler: formChat,
    body: FormChatRequest,
  })
);

export default async function wrapper(
  req: AppNextApiRequest,
  res: NextApiResponse
) {
  await runMiddleware(req, res, cors);

  return handler(req, res);
}
