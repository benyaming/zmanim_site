import { Box, Button, chakra, Checkbox, Flex, FormControl, FormLabel } from '@chakra-ui/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import { ZMANIM_KEYS } from '../../../constants/common';

export interface ZmanimInfoFiltersProps {
  handleFormSubmit: (data: { [key: string]: boolean }) => void;
}
export const ZmanimInfoFilters = (props: ZmanimInfoFiltersProps) => {
  const { handleFormSubmit } = props;
  const { handleSubmit, register } = useForm<{ [key: string]: boolean }>();

  const onSubmit = (value: { [key: string]: boolean }) => {
    handleFormSubmit(value);
  };

  return (
    <Box>
      <chakra.form onSubmit={handleSubmit(onSubmit)}>
        <Flex flexWrap="wrap">
          {ZMANIM_KEYS.map((key) => (
            <Flex key={key} mx={4}>
              <FormControl display="flex" alignItems="center">
                <Checkbox id={key} placeholder={key} {...register(key as `${number}`, { value: true })} mr={2} />
                <FormLabel htmlFor={key} m={0}>
                  {key}
                </FormLabel>
              </FormControl>
            </Flex>
          ))}
        </Flex>

        <Button mt={4} colorScheme="teal" type="submit">
          Submit
        </Button>
      </chakra.form>
    </Box>
  );
};
