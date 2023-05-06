import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import * as request from 'supertest';
import { User } from '../src/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Verification } from '../src/users/entities/verification.entity';

jest.mock('got', () => {
  return {
    default: {
      post: jest.fn(),
    },
  };
});

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  email: 'simc26@icloud.com',
  password: '12345',
};
const newUser = {
  email: 'new@mail.com',
  password: 'new_pwd',
};

describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let verificationRepository: Repository<Verification>;
  let jwtToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    dataSource = module.get<DataSource>(DataSource);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    verificationRepository = module.get<Repository<Verification>>(
      getRepositoryToken(Verification),
    );
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    app.close();
  });

  const sendRequest = (method: 'post' | 'get', query: string) => {
    return request(app.getHttpServer())[method](GRAPHQL_ENDPOINT).send({
      query,
    });
  };

  const sendRequestWithAuth = (method: 'post' | 'get', query: string) => {
    return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .set('x-jwt', jwtToken)
      .send({
        query,
      });
  };

  describe('createAccount', () => {
    let userId;
    it('should create account', async () => {
      return sendRequest(
        'post',
        `
          mutation {
            createAccount(input:{
              email: "${testUser.email}"
              password:"${testUser.password}"
              role: Owner
            }){
              error
              ok
            }
          }`,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { createAccount },
            },
          } = res;
          expect(createAccount.ok).toBe(true);
          expect(createAccount.error).toEqual(null);
        });
    });

    it('should fail if account exist', () => {
      return sendRequest(
        'post',
        `
          mutation {
            createAccount(input:{
              email: "${testUser.email}"
              password:"${testUser.password}"
              role: Owner
            }){
              error
              ok
            }
          }`,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { createAccount },
            },
          } = res;
          expect(createAccount.ok).toBe(false);
          expect(createAccount.error).toEqual(expect.any(String));
        });
    });
  });
  describe('login', () => {
    it('should login with correct credentials', () => {
      return sendRequest(
        'post',
        `mutation{
                login(input:{
                  email: "${testUser.email}"
                  password:"${testUser.password}"
                }){
                  ok
                  error
                  token
                } 
              }
          `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { login },
            },
          } = res;
          jwtToken = login.token;
          expect(login.ok).toBe(true);
          expect(login.error).toBe(null);
          expect(login.token).toEqual(expect.any(String));
        });
    });
    it('should not be able to login with wrong credentials', () => {
      return sendRequest(
        'post',
        `mutation{
                login(input:{
                  email: "weird@email.com"
                  password:"wrong_pwd"
                }){
                  ok
                  error
                  token
                } 
              }
          `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { login },
            },
          } = res;
          expect(login.ok).toBe(false);
          expect(login.error).toEqual(expect.any(String));
          expect(login.token).toBe(null);
        });
    });
  });
  describe('userProfile', () => {
    let userId: number;
    beforeAll(async () => {
      const [user] = await userRepository.find();
      userId = user.id;
    });

    it('should find a user profile', () => {
      return sendRequestWithAuth(
        'post',
        `
        {
      userProfile(userId:${userId}) {
        ok
        error
        user {
          id
        }
      }
      }
    `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                userProfile: {
                  ok,
                  error,
                  user: { id },
                },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
          expect(id).toBe(userId);
        });
    });

    it('should fail find a user profile', () => {
      const unexistUserId = 2;
      return sendRequestWithAuth(
        'post',
        `
        {
      userProfile(userId:${unexistUserId}) {
        ok
        error
        user {
          id
        }
      }
      }
    `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                userProfile: { ok, error, user },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(error).toBe('User not found');
          expect(user).toBe(null);
        });
    });
  });
  describe('me', () => {
    it('should find my profile', () => {
      return sendRequestWithAuth(
        'post',
        `
        {
      me {
        email      
        }
      }
    `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                me: { email },
              },
            },
          } = res;
          expect(email).toBe(testUser.email);
        });
    });
    it('should not find me', () => {
      return sendRequest(
        'post',
        `
        {
      me {
        email      
        }
      }
    `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: { errors },
          } = res;
          const [error] = errors;
          expect(error.message).toBe('Forbidden resource');
        });
    });
  });
  describe('editProfile', () => {
    it('should change email and password', () => {
      return sendRequestWithAuth(
        'post',
        `
        mutation{  editProfile(input:{
            email: "${newUser.email}"
            password: "${newUser.password}"
          }){
            ok
            error
          }}
        `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                editProfile: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
        });
    });
    it('should have user with changed email', async () => {
      const user = await userRepository.findOneBy({
        email: newUser.email,
      });
      console.log(user);
      expect(Boolean(user)).toBe(true);
    });
    it('should not change email in use', () => {
      return sendRequestWithAuth(
        'post',
        `
        mutation{  editProfile(input:{
            email: "${newUser.email}"
            password: "${newUser.password}"
          }){
            ok
            error
          }}
        `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                editProfile: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(error).toBe('Email is already in use');
        });
    });
  });
  describe('verifyEmail', () => {
    let verificationCode: string;
    beforeAll(async () => {
      const [verification] = await verificationRepository.find();
      verificationCode = verification.code;
    });

    it('should fail on wrong verification code', () => {
      return sendRequest(
        'post',
        `
            mutation{
  verifyEmail(input: {
    code:"weird_code"
  }){
    ok
    error
  }
}
        `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(error).toBe('Verification failed');
        });
    });

    it('should verify email', () => {
      return sendRequest(
        'post',
        `
            mutation{
  verifyEmail(input: {
    code:"${verificationCode}"
  }){
    ok
    error
  }
}
        `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
        });
    });
    it('should not verify email with same code', () => {
      return sendRequest(
        'post',
        `
            mutation{
  verifyEmail(input: {
    code:"${verificationCode}"
  }){
    ok
    error
  }
}
        `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(error).toBe('Verification failed');
        });
    });
  });
});
