FROM node:10.11
RUN yarn global add zamza
ADD bin/docker.json /opt/docker.json
ENV NODE_NO_WARNINGS 1
ENV NODE_ENV production
CMD ["zamza", "-p", "1912", "-l", "/opt/docker.json"]