import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Modal,
  Sheet,
  Stack,
  Typography,
} from '@mui/joy';
import Dropdown from '@mui/joy/Dropdown';
import Menu from '@mui/joy/Menu';
import MenuButton from '@mui/joy/MenuButton';
import MenuItem from '@mui/joy/MenuItem';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { GetServerSidePropsContext } from 'next/types';
import { useSession } from 'next-auth/react';
import { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';

import Input from '@app/components/Input';
import Layout from '@app/components/Layout';
import { getProductFromHostname } from '@app/hooks/useProduct';
import useStateReducer from '@app/hooks/useStateReducer';

import { generateActionFetcher, HTTP_METHOD } from '@chaindesk/lib/swr-fetcher';
import { fetcher } from '@chaindesk/lib/swr-fetcher';
import { RouteNames } from '@chaindesk/lib/types';
import { CreateFormSchema } from '@chaindesk/lib/types/dtos';
import { withAuth } from '@chaindesk/lib/withAuth';
import { Prisma } from '@chaindesk/prisma';

import { createForm, getForms } from '../api/forms';

export const isEmpty = (obj: any) => Object?.keys(obj || {}).length === 0;

export default function FormsPage() {
  const router = useRouter();
  const [state, setState] = useStateReducer({
    isFormModalOpen: false,
  });

  const getFormsQuery = useSWR<Prisma.PromiseReturnType<typeof getForms>>(
    '/api/forms',
    fetcher
  );

  const formMutation = useSWRMutation<
    Prisma.PromiseReturnType<typeof createForm>
  >('api/forms/', generateActionFetcher(HTTP_METHOD.POST)<CreateFormSchema>);

  const methods = useForm<CreateFormSchema>({
    resolver: zodResolver(CreateFormSchema),
    defaultValues: {},
  });

  const onSubmit = async (values: CreateFormSchema) => {
    try {
      await toast.promise(formMutation.trigger(values as any), {
        loading: 'Creating empty form...',
        success: 'Created!',
        error: 'Something went wrong',
      });
      methods.reset();
      getFormsQuery.mutate();
      setState({ isFormModalOpen: false });
    } catch (err) {
      console.log('error', err);
    }
  };
  const handleDeleteForm = async (formId: string) => {
    try {
      await toast.promise(axios.delete(`api/forms/${formId}/admin`), {
        loading: 'Processing',
        success: 'Deleted!',
        error: 'Something went wrong',
      });
      getFormsQuery.mutate();
    } catch (err) {
      console.log('error', err);
    }
  };

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <Modal
        onClose={() => setState({ isFormModalOpen: false })}
        open={state.isFormModalOpen}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Sheet
          variant="outlined"
          sx={{
            width: 600,
            maxWidth: '100%',
            borderRadius: 'md',
            p: 3,
            boxShadow: 'lg',
            overflowY: 'auto',
            maxHeight: '95vh',
          }}
        >
          <Typography level="h2">New Form</Typography>
          <Divider sx={{ my: 2 }} />
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <Input
              control={methods.control}
              label="name"
              {...methods.register('name')}
            />
            <Divider sx={{ my: 1 }} />
            <Button variant="outlined" sx={{ ml: 'auto' }} type="submit">
              Create
            </Button>
          </form>
        </Sheet>
      </Modal>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          width: 'auto',
        }}
      >
        <Button
          endDecorator={<AddIcon />}
          onClick={() => {
            setState({ isFormModalOpen: true });
          }}
        >
          Create New From
        </Button>
      </Box>
      <Box>
        <Typography level="h4">My Forms</Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        }}
      >
        {getFormsQuery?.data?.map((form, index) => (
          <Link key={form.id} href={`${RouteNames.FORMS}/${form.id}/admin`}>
            <Card
              key={index}
              variant="outlined"
              sx={{
                padding: 3,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography sx={{ fontWeight: 500 }}>{form.name}</Typography>
                <Chip
                  size={'sm'}
                  variant="soft"
                  color={isEmpty(form?.publishedConfig) ? 'warning' : 'success'}
                >
                  {isEmpty(form?.publishedConfig) ? 'Draft' : 'Published'}
                </Chip>
              </Box>
              <Box
                mt={2}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography>{form.conversations?.length} responses</Typography>
                <Dropdown>
                  <MenuButton
                    sx={{ background: 'transparent', border: 0, p: 0 }}
                    onClick={(e) => {
                      e?.preventDefault();
                      e?.stopPropagation();
                    }}
                  >
                    <MoreVertIcon />
                  </MenuButton>
                  <Menu sx={{}}>
                    <MenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteForm(form.id);
                      }}
                    >
                      Delete
                    </MenuItem>
                  </Menu>
                </Dropdown>
              </Box>
            </Card>
          </Link>
        ))}
      </Box>
    </Stack>
  );
}

FormsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export const getServerSideProps = withAuth(
  async (ctx: GetServerSidePropsContext) => {
    return {
      props: {
        product: getProductFromHostname(ctx?.req?.headers?.host),
      },
    };
  }
);
